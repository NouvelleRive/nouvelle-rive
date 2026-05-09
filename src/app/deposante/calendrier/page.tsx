'use client'

import { useEffect, useState, useMemo } from 'react'
import { collection, getDocs, query, where, doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/lib/firebaseConfig'
import { getPlacesDisponibles, isMaro } from '@/lib/capaciteDepot'
import { useEtapes } from '../layout'
import PlanningCalendar from '@/components/PlanningCalendar'

const MAX_PIECES_PAR_RDV = 5
// Créneaux horaires (même règles que les chineuses : mardi a un créneau de plus)
const CRENEAUX_NORMAL = ['13h', '16h']
const CRENEAUX_MARDI = ['13h', '16h', '18h']

type Piece = { id: string; nom?: string; sku?: string; categorie?: string; recu?: boolean; vendu?: boolean; statutRecuperation?: string; rdvDate?: string; rdvCreneau?: string }
type Slot = { nom: string; type: 'chineuse' | 'deposante'; trigramme?: string; pieceIds?: string[] }

function formatMonthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}
function formatDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function DeposanteCalendrierPage() {
  const etapes = useEtapes()
  const [userUid, setUserUid] = useState<string>('')
  const [userTrigramme, setUserTrigramme] = useState<string>('')
  const [userNom, setUserNom] = useState<string>('')

  const [pieces, setPieces] = useState<Piece[]>([])
  const [restockSlots, setRestockSlots] = useState<Record<string, Slot>>({})
  const [config, setConfig] = useState<{ maxPap: number; maxMaro: number }>({ maxPap: 0, maxMaro: 0 })
  const [allProduits, setAllProduits] = useState<any[]>([])

  const today = useMemo(() => {
    const n = new Date()
    return formatDateStr(n.getFullYear(), n.getMonth(), n.getDate())
  }, [])
  const [currentMonth, setCurrentMonth] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })
  const monthKey = formatMonthKey(currentMonth.year, currentMonth.month)

  // Modale
  const [openDate, setOpenDate] = useState<string | null>(null)
  const [openCreneau, setOpenCreneau] = useState<string>('')
  const [openPieceIds, setOpenPieceIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Auth + récupération trigramme
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return
      setUserUid(u.uid)
      let trigramme = ''
      let nom = ''
      try {
        const snap = await getDoc(doc(db, 'deposante', u.uid))
        if (snap.exists()) {
          const d = snap.data() as any
          trigramme = (d.trigramme || '').toUpperCase()
          nom = (d.nom || d.prenom || '').toUpperCase()
        } else {
          const fb = await getDocs(query(collection(db, 'deposante'), where('authUid', '==', u.uid)))
          if (!fb.empty) {
            const d = fb.docs[0].data() as any
            trigramme = (d.trigramme || '').toUpperCase()
            nom = (d.nom || d.prenom || '').toUpperCase()
          }
        }
      } catch (e) { console.error(e) }
      setUserTrigramme(trigramme)
      setUserNom(nom || trigramme)
    })
    return () => unsub()
  }, [])

  // Listener pièces de la déposante
  useEffect(() => {
    if (!userTrigramme) return
    const q = query(
      collection(db, 'produits'),
      where('trigramme', '==', userTrigramme),
      where('source', '==', 'deposante')
    )
    const unsub = onSnapshot(q, (snap) => {
      setPieces(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
    })
    return () => unsub()
  }, [userTrigramme])

  // Listener slots du mois affiché
  useEffect(() => {
    const ref = doc(db, 'restocks', monthKey)
    const unsub = onSnapshot(ref, (snap) => {
      setRestockSlots(snap.exists() ? (snap.data().slots || {}) : {})
    })
    return () => unsub()
  }, [monthKey])

  // Config + tous produits (pour places dispo)
  useEffect(() => {
    ;(async () => {
      try {
        const [cfgNew, cfgOld, prodSnap] = await Promise.all([
          getDoc(doc(db, 'siteConfig', 'capacite')),
          getDoc(doc(db, 'config', 'capacite')).catch(() => null),
          getDocs(collection(db, 'produits')),
        ])
        const cfgSnap = cfgNew.exists() ? cfgNew : (cfgOld && cfgOld.exists() ? cfgOld : null)
        if (cfgSnap && cfgSnap.exists()) {
          const d = cfgSnap.data() as any
          setConfig({ maxPap: d.maxPap || 0, maxMaro: d.maxMaro || 0 })
        }
        setAllProduits(prodSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
      } catch (e) { console.error(e) }
    })()
  }, [])

  const placesDisponibles = useMemo(
    () => getPlacesDisponibles(allProduits, config, restockSlots, today),
    [allProduits, config, restockSlots, today]
  )

  // Pièces sélectionnables : non vendues, non reçues, non récupérées, pas déjà liées à un autre RDV futur (sauf modif du même RDV)
  const piecesSelectionnables = useMemo(() => {
    const piecesAvecRdvFutur = new Set<string>()
    Object.entries(restockSlots).forEach(([key, slot]) => {
      const dateStr = key.split('_')[0]
      if (slot.type === 'deposante' && slot.trigramme === userTrigramme && dateStr >= today) {
        ;(slot.pieceIds || []).forEach(id => piecesAvecRdvFutur.add(id))
      }
    })
    return pieces.filter(p => !p.vendu && !p.recu && p.statutRecuperation !== 'recupere' && !piecesAvecRdvFutur.has(p.id))
  }, [pieces, restockSlots, userTrigramme, today])

  // Détection RDV existant pour ce trigramme
  const monRdv = useMemo(() => {
    for (const [key, slot] of Object.entries(restockSlots)) {
      const dateStr = key.split('_')[0]
      if (slot.type === 'deposante' && slot.trigramme === userTrigramme && dateStr >= today) {
        return { key, dateStr, creneau: key.split('_')[1], slot }
      }
    }
    return null
  }, [restockSlots, userTrigramme, today])

  // Disponibilité par jour
  function getDayInfo(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay() // 0=dim, 6=sam
    const isWeekend = dow === 0 || dow === 6
    const isPast = dateStr < today

    const creneaux: string[] = dow === 2 ? CRENEAUX_MARDI : CRENEAUX_NORMAL

    // Pour chaque créneau : libre si pas de chineuse ni autre déposante
    const creneauxDispo = creneaux.filter(cr => {
      const slot = restockSlots[`${dateStr}_${cr}`]
      if (!slot) return true
      // weekend : pas de chineuse possible (boutique fermée), donc dispo si pas une autre déposante
      // semaine : pas dispo si chineuse présente OU autre déposante présente
      return false
    })

    const reservedByMe = monRdv?.dateStr === dateStr
    const fullyBooked = creneauxDispo.length === 0
    const dayHasChineuse = !isWeekend && creneaux.some(cr => restockSlots[`${dateStr}_${cr}`]?.type === 'chineuse')

    return { isPast, isWeekend, creneauxDispo, reservedByMe, fullyBooked, dayHasChineuse }
  }

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentMonth.year, currentMonth.month, 1)
    const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0)
    const startPad = (firstDay.getDay() + 6) % 7
    const arr: (number | null)[] = []
    for (let i = 0; i < startPad; i++) arr.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) arr.push(d)
    return arr
  }, [currentMonth])

  const monthLabel = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  function navMonth(delta: number) {
    setCurrentMonth(prev => {
      const m = prev.month + delta
      const yearShift = Math.floor(m / 12)
      return { year: prev.year + yearShift, month: ((m % 12) + 12) % 12 }
    })
  }

  function openModal(dateStr: string) {
    const info = getDayInfo(dateStr)
    if (info.isPast) return
    if (info.fullyBooked && !info.reservedByMe) return
    setErrorMsg('')
    if (info.reservedByMe && monRdv) {
      // pré-remplir avec le RDV existant
      setOpenDate(monRdv.dateStr)
      setOpenCreneau(monRdv.creneau)
      setOpenPieceIds(monRdv.slot.pieceIds || [])
    } else {
      setOpenDate(dateStr)
      setOpenCreneau(info.creneauxDispo[0] || '')
      setOpenPieceIds([])
    }
  }

  // Max effectif = min(5, places dispo + pièces déjà compabilisées dans mon RDV existant)
  const effectiveMaxPieces = useMemo(() => {
    const myExisting = monRdv && monRdv.dateStr === openDate ? (monRdv.slot.pieceIds?.length || 0) : 0
    return Math.min(MAX_PIECES_PAR_RDV, placesDisponibles.total + myExisting)
  }, [placesDisponibles.total, monRdv, openDate])

  function togglePiece(id: string) {
    setOpenPieceIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= effectiveMaxPieces) return prev
      return [...prev, id]
    })
  }

  async function saveRdv() {
    if (!openDate || !openCreneau) { setErrorMsg('Choisissez un créneau'); return }
    if (openPieceIds.length === 0) { setErrorMsg('Sélectionnez au moins une pièce'); return }
    if (openPieceIds.length > MAX_PIECES_PAR_RDV) { setErrorMsg(`Maximum ${MAX_PIECES_PAR_RDV} pièces`); return }

    // Vérif places (PAP / Maro) — comparer aux pièces de ce RDV
    const piecesChoisies = pieces.filter(p => openPieceIds.includes(p.id))
    const nbMaro = piecesChoisies.filter(p => isMaro(p.categorie || '')).length
    const nbPap = piecesChoisies.length - nbMaro
    // On retire les pièces déjà comptées dans le RDV existant pour le calcul net
    const dejaComptePap = monRdv && monRdv.dateStr === openDate ? (monRdv.slot.pieceIds || []).filter(id => {
      const p = pieces.find(x => x.id === id); return p && !isMaro(p.categorie || '')
    }).length : 0
    const dejaCompteMaro = monRdv && monRdv.dateStr === openDate ? (monRdv.slot.pieceIds || []).filter(id => {
      const p = pieces.find(x => x.id === id); return p && isMaro(p.categorie || '')
    }).length : 0
    const netPap = nbPap - dejaComptePap
    const netMaro = nbMaro - dejaCompteMaro
    if (netPap > placesDisponibles.pap) { setErrorMsg(`Trop de prêt-à-porter : ${placesDisponibles.pap} place(s) disponible(s)`); return }
    if (netMaro > placesDisponibles.maro) { setErrorMsg(`Trop de maroquinerie : ${placesDisponibles.maro} place(s) disponible(s)`); return }

    setSaving(true)
    try {
      const ref = doc(db, 'restocks', monthKey)
      const snap = await getDoc(ref)
      const slots = snap.exists() ? (snap.data().slots || {}) : {}

      // Si déplacement : supprimer ancien RDV
      if (monRdv && (monRdv.dateStr !== openDate || monRdv.creneau !== openCreneau)) {
        delete slots[monRdv.key]
      }

      const newKey = `${openDate}_${openCreneau}`
      slots[newKey] = {
        nom: userNom || userTrigramme,
        type: 'deposante',
        trigramme: userTrigramme,
        pieceIds: openPieceIds,
      }

      if (snap.exists()) {
        await updateDoc(ref, { slots })
      } else {
        await setDoc(ref, { slots })
      }

      // Email "demande de RDV reçue, en attente de validation par l'équipe"
      try {
        const idToken = await auth.currentUser?.getIdToken()
        if (idToken) {
          await fetch('/api/deposante/rdv-demande', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ monthKey, slotKey: newKey }),
          })
        }
      } catch (e) { console.error('rdv-demande email:', e) }

      setOpenDate(null)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function cancelRdv() {
    if (!monRdv) return
    if (!confirm('Annuler votre rendez-vous ?')) return
    setSaving(true)
    try {
      const ref = doc(db, 'restocks', monthKey)
      const snap = await getDoc(ref)
      const slots = snap.exists() ? (snap.data().slots || {}) : {}
      delete slots[monRdv.key]
      await updateDoc(ref, { slots })
      setOpenDate(null)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  if (!etapes.profil) return <div className="p-12 text-center text-gray-500">Complète ton profil pour continuer →</div>
  if (!etapes.contrat) return <div className="p-12 text-center text-gray-500">Signe ton contrat pour continuer →</div>
  if (!etapes.validee) return <div className="p-12 text-center text-gray-500">Profil en cours de validation 💙 — vous recevrez un email dès que c'est bon.</div>
  if (!etapes.pieces) return <div className="p-12 text-center text-gray-500">Ajoute tes pièces pour continuer →</div>

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-bold text-[#22209C] mb-4">Prendre rendez-vous</h1>

      {monRdv && !(monRdv.slot as any).acceptee && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-[#22209C]">
          Dépôt en cours de validation 💙 — notre équipe revoit votre RDV et vos pièces, vous recevrez un email dès que c'est confirmé.
        </div>
      )}

      <div className="mb-4 p-3 bg-gray-50 border rounded text-xs flex flex-wrap gap-3">
        <span><span className={`font-medium ${placesDisponibles.pap === 0 ? 'text-orange-500' : 'text-gray-700'}`}>PAP : {placesDisponibles.pap} place{placesDisponibles.pap !== 1 ? 's' : ''}</span></span>
        <span className="text-gray-300">·</span>
        <span><span className={`font-medium ${placesDisponibles.maro === 0 ? 'text-orange-500' : 'text-gray-700'}`}>MARO : {placesDisponibles.maro} place{placesDisponibles.maro !== 1 ? 's' : ''}</span></span>
        {monRdv && <>
          <span className="text-gray-300">·</span>
          <span className="font-medium text-[#22209C]">Votre RDV : {monRdv.dateStr} à {monRdv.creneau} ({monRdv.slot.pieceIds?.length || 0} pièce{(monRdv.slot.pieceIds?.length || 0) !== 1 ? 's' : ''}){(monRdv.slot as any).acceptee ? ' ✓ confirmé' : ' · en attente'}</span>
        </>}
      </div>

      <PlanningCalendar
        mode="restock"
        userType="deposante"
        userNom={userNom || userTrigramme}
        participants={userTrigramme ? [{ nom: userNom || userTrigramme, type: 'deposante', trigramme: userTrigramme }] : []}
        currentMonth={currentMonth}
        onNavigate={navMonth}
        onRestockSlotPick={(ds, cr, val) => {
          // Si la déposante choisit son nom dans un créneau → on ouvre la modale
          // de sélection des pièces au lieu de sauvegarder directement.
          if (!val) return true // suppression : pass-through
          const info = getDayInfo(ds)
          if (info.isPast) return false
          setOpenDate(ds)
          setOpenCreneau(cr)
          setOpenPieceIds(monRdv?.dateStr === ds && monRdv?.creneau === cr ? (monRdv.slot.pieceIds || []) : [])
          return false // bypass save par défaut
        }}
      />

      {/* Modale RDV */}
      {openDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-1">Rendez-vous</h3>
            <p className="text-sm text-gray-600 mb-4">{openDate}</p>

            {/* Créneau */}
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Créneau</label>
            <select
              value={openCreneau}
              onChange={e => setOpenCreneau(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm mb-4"
            >
              {(() => {
                const info = getDayInfo(openDate)
                const dispo = info.creneauxDispo
                // Si on modifie son propre RDV, autoriser aussi son créneau actuel
                const opts = monRdv?.dateStr === openDate
                  ? Array.from(new Set([...dispo, monRdv.creneau]))
                  : dispo
                return opts.map(cr => <option key={cr} value={cr}>{cr}</option>)
              })()}
            </select>

            {/* Pièces */}
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Pièces à déposer ({openPieceIds.length}/{effectiveMaxPieces})
              {effectiveMaxPieces < MAX_PIECES_PAR_RDV && (
                <span className="ml-2 text-orange-500 normal-case font-normal">— limité par les places dispo</span>
              )}
            </label>
            {piecesSelectionnables.length === 0 ? (
              <p className="text-sm text-gray-500 mb-4">Aucune pièce disponible. Ajoutez-en via "Ajouter une pièce".</p>
            ) : (
              <div className="space-y-1 mb-4 max-h-64 overflow-y-auto border rounded p-2">
                {piecesSelectionnables.map(p => {
                  const checked = openPieceIds.includes(p.id)
                  const disabled = !checked && openPieceIds.length >= effectiveMaxPieces
                  return (
                    <label key={p.id} className={`flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-gray-50 ${disabled ? 'opacity-40' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => togglePiece(p.id)}
                      />
                      <span className="flex-1 truncate">{p.sku || ''} {p.nom?.replace(`${p.sku} - `, '') || ''}</span>
                      <span className="text-xs text-gray-400">{p.categorie?.replace('DEP - ', '')}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {errorMsg && <p className="text-xs text-red-600 mb-3">{errorMsg}</p>}

            <div className="flex gap-2 justify-between">
              <div>
                {monRdv && monRdv.dateStr === openDate && (
                  <button onClick={cancelRdv} disabled={saving} className="text-xs text-red-600 hover:underline">Annuler le RDV</button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOpenDate(null)}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-widest border border-black"
                >
                  Fermer
                </button>
                <button
                  onClick={saveRdv}
                  disabled={saving || piecesSelectionnables.length === 0}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
                  style={{ backgroundColor: '#22209C' }}
                >
                  {saving ? 'Sauvegarde…' : (monRdv?.dateStr === openDate ? 'Mettre à jour' : 'Confirmer le RDV')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
