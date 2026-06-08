  // app/admin/vendeuses/page.tsx
  'use client'

  import { format } from 'date-fns'
  import { useEffect, useState, useMemo } from 'react'
  import {
    collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
    serverTimestamp, getDoc, setDoc, Timestamp, onSnapshot, deleteField
  } from 'firebase/firestore'
  import { db } from '@/lib/firebaseConfig'
  import { Plus, X, ChevronLeft, ChevronRight, Wand2 } from 'lucide-react'
  import PlanningCalendar from '@/components/PlanningCalendar'
  import PointagesSection from '@/components/admin/PointagesSection'

  // =====================
  // TYPES
  // =====================
  type Vendeuse = {
    id: string
    prenom: string
    couleur: string
    actif: boolean
    createdAt?: Timestamp
    joursFixes?: Record<string, string> // ex: { "1": "12-20", "0": "11-17" } (0=dimanche, 1=lundi...)
  }

  type PlanningSlots = Record<string, string> // "2026-02-05_12-20": vendeuse_id

  type ProduitVente = {
    id: string
    prix?: number
    prixVenteReel?: number
    vendu?: boolean
    statut?: string
    quantite?: number
    dateVente?: Timestamp
    updatedAt?: Timestamp
    createdAt?: Timestamp
    vendeuseId?: string | null
    vendeusePrenom?: string | null
    venteFamiliale?: boolean
    source?: string
    sku?: string | null
    nom?: string | null
  }

  const CRENEAUX = ['12-20', '11-17'] as const
  const JOURS_SEMAINE = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
  const JOURS_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

  const COULEURS_PRESET = [
    '#DC2626', // rouge
    '#000000', // noir
    '#6D8B3A', // olive/vert
    '#2563EB', // bleu
    '#9333EA', // violet
    '#EC4899', // rose
    '#F59E0B', // jaune
    '#0D9488', // teal
  ]

  // =====================
  // COMPOSANT PRINCIPAL
  // =====================
  export default function VendeusesPage() {
    const [vendeuses, setVendeuses] = useState<Vendeuse[]>([])
    const [loading, setLoading] = useState(true)

    // Modal ajout
    const [showAdd, setShowAdd] = useState(false)
    const [newPrenom, setNewPrenom] = useState('')
    const [newCouleur, setNewCouleur] = useState(COULEURS_PRESET[0])

    // Modal jours fixes
    const [editJoursFixesFor, setEditJoursFixesFor] = useState<Vendeuse | null>(null)
    const [tempJoursFixes, setTempJoursFixes] = useState<Record<string, string>>({})

    // Planning
    const [currentMonth, setCurrentMonth] = useState(() => {
      const now = new Date()
      return { year: now.getFullYear(), month: now.getMonth() }
    })
    const [planningSlots, setPlanningSlots] = useState<PlanningSlots>({})
    const [planningLoading, setPlanningLoading] = useState(false)
    const [ventesAll, setVentesAll] = useState<ProduitVente[]>([])
    type Pointage = { id: string; vendeuseId: string; date: string; arrivee: string | null; depart: string | null }
    const [pointages, setPointages] = useState<Pointage[]>([])

    // =====================
    // FETCH VENDEUSES
    // =====================
    const fetchVendeuses = async () => {
      const snap = await getDocs(collection(db, 'vendeuses'))
      const list: Vendeuse[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Vendeuse))
      list.sort((a, b) => a.prenom.localeCompare(b.prenom))
      setVendeuses(list)
      setLoading(false)
    }

    // =====================
    // FETCH PLANNING DU MOIS
    // =====================
    const monthKey = useMemo(() => {
      const m = (currentMonth.month + 1).toString().padStart(2, '0')
      return `${currentMonth.year}-${m}`
    }, [currentMonth])

    const fetchPlanning = async () => {
      setPlanningLoading(true)
      const docRef = doc(db, 'planning', monthKey)
      const snap = await getDoc(docRef)
      if (snap.exists()) {
        setPlanningSlots(snap.data().slots || {})
      } else {
        setPlanningSlots({})
      }
      setPlanningLoading(false)
    }

    useEffect(() => {
      fetchVendeuses()
    }, [])

    useEffect(() => {
      fetchPlanning()
    }, [monthKey])

    // Charger les pointages du mois
    useEffect(() => {
      (async () => {
        try {
          const res = await fetch(`/api/pointage?mois=${monthKey}`)
          const data = await res.json()
          if (data.success) setPointages(data.items || [])
        } catch {}
      })()
    }, [monthKey])

    // Charger les ventes
    useEffect(() => {
    const unsub = onSnapshot(collection(db, 'ventes'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProduitVente))
      setVentesAll(list)
    })
    return () => unsub()
  }, [])

    // =====================
    // AJOUTER VENDEUSE
    // =====================
    const handleAdd = async () => {
      if (!newPrenom.trim()) return
      await addDoc(collection(db, 'vendeuses'), {
        prenom: newPrenom.trim(),
        couleur: newCouleur,
        actif: true,
        joursFixes: {},
        createdAt: serverTimestamp()
      })
      setNewPrenom('')
      setNewCouleur(COULEURS_PRESET[0])
      setShowAdd(false)
      fetchVendeuses()
    }

    // =====================
    // TOGGLE ACTIF
    // =====================
    const toggleActif = async (v: Vendeuse) => {
      await updateDoc(doc(db, 'vendeuses', v.id), { actif: !v.actif })
      fetchVendeuses()
    }

    // =====================
    // SUPPRIMER VENDEUSE
    // =====================
    const handleDelete = async (v: Vendeuse) => {
      if (!confirm(`Supprimer ${v.prenom} ?`)) return
      await deleteDoc(doc(db, 'vendeuses', v.id))
      fetchVendeuses()
    }

    // =====================
    // SAUVEGARDER JOURS FIXES
    // =====================
    const saveJoursFixes = async () => {
      if (!editJoursFixesFor) return
      await updateDoc(doc(db, 'vendeuses', editJoursFixesFor.id), {
        joursFixes: tempJoursFixes
      })
      setEditJoursFixesFor(null)
      fetchVendeuses()
    }

    // =====================
    // SAUVEGARDER PLANNING (full overwrite, utilisé par autoFill + bouton Enregistrer)
    // =====================
    const savePlanning = async (newSlots: PlanningSlots) => {
      setPlanningSlots(newSlots)
      const docRef = doc(db, 'planning', monthKey)
      await setDoc(docRef, { slots: newSlots })
    }

    // =====================
    // ASSIGNER UN CRÉNEAU — écriture atomique par slot (évite la race condition
    // qui réinjectait les vendeuses supprimées quand on en retirait plusieurs vite)
    // =====================
    const assignSlot = async (dateStr: string, creneau: string, vendeuseId: string | '') => {
      const key = `${dateStr}_${creneau}`
      setPlanningSlots(prev => {
        const next = { ...prev }
        if (vendeuseId === '') delete next[key]
        else next[key] = vendeuseId
        return next
      })
      const docRef = doc(db, 'planning', monthKey)
      if (vendeuseId === '') {
        try {
          await updateDoc(docRef, { [`slots.${key}`]: deleteField() })
        } catch {
          // Doc absent ou champ inexistant — rien à supprimer
        }
      } else {
        await setDoc(docRef, { slots: { [key]: vendeuseId } }, { merge: true })
      }
    }

    // Re-sauvegarde complète du planning courant (bouton Enregistrer manuel)
    const handleManualSave = async () => {
      await savePlanning(planningSlots)
    }

    // =====================
    // AUTO-REMPLIR LE MOIS
    // =====================
    const autoFill = () => {
      const newSlots = { ...planningSlots }
      const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate()

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentMonth.year, currentMonth.month, day)
        const dayOfWeek = date.getDay().toString() // 0=dim, 1=lun...
        const dateStr = `${currentMonth.year}-${(currentMonth.month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

        // Pour chaque vendeuse active avec des jours fixes
        vendeuses.filter(v => v.actif && v.joursFixes).forEach(v => {
          const creneau = v.joursFixes?.[dayOfWeek]
          if (creneau) {
            const key = `${dateStr}_${creneau}`
            // Ne pas écraser si déjà assigné
            if (!newSlots[key]) {
              newSlots[key] = v.id
            }
          }
        })
      }

      savePlanning(newSlots)
    }

    // =====================
    // CALENDRIER : JOURS DU MOIS
    // =====================
    const calendarDays = useMemo(() => {
      const firstDay = new Date(currentMonth.year, currentMonth.month, 1)
      const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0)
      const startPad = firstDay.getDay() // 0=dim
      const days: (number | null)[] = []

      for (let i = 0; i < startPad; i++) days.push(null)
      for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)

      return days
    }, [currentMonth])

    // =====================
    // HELPERS
    // =====================
    const getVendeuse = (id: string) => vendeuses.find(v => v.id === id)

    const monthLabel = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric'
    })

    const navigateMonth = (delta: number) => {
      setCurrentMonth(prev => {
        let m = prev.month + delta
        let y = prev.year
        if (m < 0) { m = 11; y-- }
        if (m > 11) { m = 0; y++ }
        return { year: y, month: m }
      })
    }

    const activeVendeuses = vendeuses.filter(v => v.actif)

    // Heures par créneau
    const heuresCreneau = (cr: string) => cr === '12-20' ? 8 : cr === '11-17' ? 6 : 0

    // Heures supposées (depuis jours fixes × semaines du mois)
    const heuresSupposees = (v: Vendeuse) => {
      if (!v.joursFixes) return 0
      const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate()
      let total = 0
      for (let day = 1; day <= daysInMonth; day++) {
        const dow = new Date(currentMonth.year, currentMonth.month, day).getDay().toString()
        const cr = v.joursFixes[dow]
        if (cr) total += heuresCreneau(cr)
      }
      return total
    }

    // Heures réelles (somme des pointages : depart - arrivee). Pas de pointage → pas payée.
    const heuresReelles = (vendeuseId: string) => {
      let total = 0
      for (const p of pointages) {
        if (p.vendeuseId !== vendeuseId) continue
        if (!p.arrivee || !p.depart) continue
        total += (new Date(p.depart).getTime() - new Date(p.arrivee).getTime()) / 3600000
      }
      return total
    }

    // CA par vendeuse (réconciliation planning + ventes du mois)
    const caParVendeuse = useMemo(() => {
      const map = new Map<string, { ca: number; ventes: number; bonus: number; discountCount: number; discountTotal: number }>()



      // Helper : une vente familiale ne compte JAMAIS pour le CA/bonus vendeuse
      const isFamiliale = (v: ProduitVente) => v.venteFamiliale === true || v.source === 'familiale'

      ventesAll.forEach(p => {
        if (isFamiliale(p)) return
        if (!(p.dateVente instanceof Timestamp)) return
        const date = p.dateVente.toDate()
        if (date.getMonth() !== currentMonth.month || date.getFullYear() !== currentMonth.year) return

        const dateStr = format(date, 'yyyy-MM-dd')
        const hour = date.getHours()
        const slot1220 = planningSlots[`${dateStr}_12-20`]
        const slot1117 = planningSlots[`${dateStr}_11-17`]
        const montant = p.prixVenteReel || 0
        const discount = (p.prix || 0) - (p.prixVenteReel || 0)
        const hasDiscount = discount > 0

        const addTo = (id: string, fraction: number) => {
          const cur = map.get(id) || { ca: 0, ventes: 0, bonus: 0, discountCount: 0, discountTotal: 0 }
          map.set(id, {
            ...cur,
            ca: cur.ca + montant * fraction,
            ventes: cur.ventes + fraction,
            discountCount: cur.discountCount + (hasDiscount ? fraction : 0),
            discountTotal: cur.discountTotal + discount * fraction,
          })
        }

        if (slot1117 && slot1220) {
          if (hour < 12) {
            addTo(slot1117, 1)
          } else if (hour < 17) {
            addTo(slot1117, 1)
            addTo(slot1220, 1)
          } else {
            addTo(slot1220, 1)
          }
        } else {
          const vendeuseId = slot1220 || slot1117
          if (vendeuseId) addTo(vendeuseId, 1)
        }
      })

      // Pass 2 : bonus par créneau (seuil sur CA total du jour 11-20)
      const ca1220 = new Map<string, number>()
      const ca1117 = new Map<string, number>()
      const caJour = new Map<string, number>()

      ventesAll.forEach(p => {
        if (isFamiliale(p)) return
        if (!(p.dateVente instanceof Timestamp)) return
        const date = p.dateVente.toDate()
        if (date.getMonth() !== currentMonth.month || date.getFullYear() !== currentMonth.year) return

        const dateStr = format(date, 'yyyy-MM-dd')
        const hour = date.getHours()
        const montant = p.prixVenteReel || 0

        if (hour >= 12 && hour < 20) {
          ca1220.set(dateStr, (ca1220.get(dateStr) || 0) + montant)
        }
        if (hour >= 11 && hour < 17) {
          ca1117.set(dateStr, (ca1117.get(dateStr) || 0) + montant)
        }
        caJour.set(dateStr, (caJour.get(dateStr) || 0) + montant)
      })

      // Pointages du mois groupés par jour
      const pointagesByDay = new Map<string, Pointage[]>()
      for (const p of pointages) {
        if (!pointagesByDay.has(p.date)) pointagesByDay.set(p.date, [])
        pointagesByDay.get(p.date)!.push(p)
      }

      // Pour chaque jour du mois : si pointages → on utilise les heures réelles ;
      // sinon → on retombe sur la logique planning (créneaux 12-20 / 11-17).
      const allDates = new Set<string>([
        ...ca1220.keys(), ...ca1117.keys(), ...caJour.keys(),
      ])
      for (const dateStr of allDates) {
        if ((caJour.get(dateStr) || 0) < 1000) continue
        const ptsToday = pointagesByDay.get(dateStr) || []

        if (ptsToday.length > 0) {
          // Logique pointage : pour chaque vente du jour, attribuer aux vendeuses présentes
          const ventesDuJour = ventesAll.filter(v => {
            if (isFamiliale(v)) return false
            if (!(v.dateVente instanceof Timestamp)) return false
            const d = v.dateVente.toDate()
            return format(d, 'yyyy-MM-dd') === dateStr
          })
          for (const v of ventesDuJour) {
            const venteTime = (v.dateVente as Timestamp).toDate().getTime()
            const montant = v.prixVenteReel || 0
            for (const p of ptsToday) {
              if (!p.arrivee) continue
              const arr = new Date(p.arrivee).getTime()
              const dep = p.depart ? new Date(p.depart).getTime() : Infinity
              if (venteTime >= arr && venteTime <= dep) {
                const cur = map.get(p.vendeuseId)
                if (cur) map.set(p.vendeuseId, { ...cur, bonus: cur.bonus + montant * 0.01 })
              }
            }
          }
        } else {
          // Logique planning historique (fallback : pas de pointages ce jour-là)
          const v1220 = planningSlots[`${dateStr}_12-20`]
          const v1117 = planningSlots[`${dateStr}_11-17`]
          if (v1220) {
            const ca = ca1220.get(dateStr) || 0
            const cur = map.get(v1220)
            if (cur) map.set(v1220, { ...cur, bonus: cur.bonus + ca * 0.01 })
          }
          if (v1117) {
            const ca = ca1117.get(dateStr) || 0
            const cur = map.get(v1117)
            if (cur) map.set(v1117, { ...cur, bonus: cur.bonus + ca * 0.01 })
          }
        }
      }

      return map
    }, [ventesAll, planningSlots, currentMonth, pointages])

    // Ventes familiales attribuées à une vendeuse (mois courant)
    const ventesFamilialesParVendeuse = useMemo(() => {
      const map = new Map<string, { total: number; count: number; items: ProduitVente[] }>()
      ventesAll.forEach(v => {
        if (!(v.venteFamiliale === true || v.source === 'familiale')) return
        if (!v.vendeuseId) return
        if (!(v.dateVente instanceof Timestamp)) return
        const d = v.dateVente.toDate()
        if (d.getMonth() !== currentMonth.month || d.getFullYear() !== currentMonth.year) return
        const cur = map.get(v.vendeuseId) || { total: 0, count: 0, items: [] }
        cur.total += v.prixVenteReel || 0
        cur.count += 1
        cur.items.push(v)
        map.set(v.vendeuseId, cur)
      })
      return map
    }, [ventesAll, currentMonth])

    const dailyCA = useMemo(() => {
  const ca: Record<string, number> = {}
  ventesAll.forEach(p => {
    if (!(p.dateVente instanceof Timestamp)) return
    const date = p.dateVente.toDate()
    if (date.getMonth() !== currentMonth.month || date.getFullYear() !== currentMonth.year) return
    const dateStr = format(date, 'yyyy-MM-dd')
    ca[dateStr] = (ca[dateStr] || 0) + (p.prixVenteReel || 0)
  })
  return ca
}, [ventesAll, currentMonth])

  const dailyCAByCreneau = useMemo(() => {
    const ca: Record<string, { '12-20': number; '11-17': number }> = {}
    ventesAll.forEach(p => {
      if (!(p.dateVente instanceof Timestamp)) return
      const date = p.dateVente.toDate()
      if (date.getMonth() !== currentMonth.month || date.getFullYear() !== currentMonth.year) return
      const dateStr = format(date, 'yyyy-MM-dd')
      const hour = date.getHours()
      const montant = p.prixVenteReel || 0
      if (!ca[dateStr]) ca[dateStr] = { '12-20': 0, '11-17': 0 }
      if (hour >= 12 && hour < 20) ca[dateStr]['12-20'] += montant
      if (hour >= 11 && hour < 17) ca[dateStr]['11-17'] += montant
    })
    return ca
  }, [ventesAll, currentMonth])

    // Jours de CP = jours supposés - jours réels travaillés
    const joursCP = (v: Vendeuse) => {
      const supposees = heuresSupposees(v)
      const reelles = heuresReelles(v.id)
      const diff = supposees - reelles
      return diff > 0 ? diff : 0
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
        </div>
      )
    }

    return (
      <div className="space-y-8">
        {/* ======================== */}
        {/* SECTION VENDEUSES        */}
        {/* ======================== */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#22209C]">Vendeuses</h2>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-[#22209C] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1a1878] transition"
            >
              <Plus size={16} /> Ajouter
            </button>
          </div>

          {/* Liste */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {vendeuses.map(v => (
              <div
                key={v.id}
                className={`bg-white rounded-lg border p-4 flex items-center justify-between transition ${
                  !v.actif ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: v.couleur }}
                  />
                <span className="font-semibold text-sm">{v.prenom.toUpperCase()}</span>
                  <span className="text-xs text-gray-400">{heuresSupposees(v)}h prévues</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditJoursFixesFor(v)
                      setTempJoursFixes(v.joursFixes || {})
                    }}
                    className="text-xs text-gray-500 hover:text-[#22209C] border rounded px-2 py-1"
                    title="Jours fixes"
                  >
                    📅
                  </button>
                  <button
                    onClick={() => toggleActif(v)}
                    className={`text-xs px-2 py-1 rounded border ${
                      v.actif ? 'text-green-600 border-green-300' : 'text-gray-400 border-gray-200'
                    }`}
                  >
                    {v.actif ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => handleDelete(v)}
                    className="text-gray-300 hover:text-red-500 transition"
                    title="Supprimer"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {vendeuses.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">Aucune vendeuse ajoutée</p>
          )}
        </div>

        {/* ======================== */}
        {/* MODAL AJOUT              */}
        {/* ======================== */}
        {showAdd && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
            <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4">Nouvelle vendeuse</h3>
              <input
                type="text"
                placeholder="Prénom"
                value={newPrenom}
                onChange={e => setNewPrenom(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 mb-4 text-sm"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <div className="mb-4">
                <label className="text-xs text-gray-500 mb-2 block">Couleur</label>
                <div className="flex gap-2 flex-wrap">
                  {COULEURS_PRESET.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewCouleur(c)}
                      className="w-8 h-8 rounded-full transition-transform"
                      style={{
                        backgroundColor: c,
                        transform: newCouleur === c ? 'scale(1.3)' : 'scale(1)',
                        border: newCouleur === c ? '3px solid #22209C' : '2px solid #e5e7eb'
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAdd}
                  className="flex-1 bg-[#22209C] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#1a1878]"
                >
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================== */}
        {/* MODAL JOURS FIXES        */}
        {/* ======================== */}
        {editJoursFixesFor && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditJoursFixesFor(null)}>
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-1">Jours fixes — {editJoursFixesFor.prenom.toUpperCase()}</h3>
              <p className="text-xs text-gray-400 mb-4">Sélectionne le créneau habituel pour chaque jour</p>

              <div className="space-y-2">
                {JOURS_LABELS.map((label, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm font-medium w-24">{label}</span>
                    <div className="flex gap-2">
                      {CRENEAUX.map(cr => (
                        <button
                          key={cr}
                          onClick={() => {
                            const newJF = { ...tempJoursFixes }
                            if (newJF[idx.toString()] === cr) {
                              delete newJF[idx.toString()]
                            } else {
                              newJF[idx.toString()] = cr
                            }
                            setTempJoursFixes(newJF)
                          }}
                          className={`text-xs px-3 py-1.5 rounded-full border transition ${
                            tempJoursFixes[idx.toString()] === cr
                              ? 'text-white border-transparent'
                              : 'text-gray-500 border-gray-200 hover:border-gray-400'
                          }`}
                          style={{
                            backgroundColor: tempJoursFixes[idx.toString()] === cr ? editJoursFixesFor.couleur : undefined
                          }}
                        >
                          {cr}
                        </button>
                      ))}
                      {tempJoursFixes[idx.toString()] && (
                        <button
                          onClick={() => {
                            const newJF = { ...tempJoursFixes }
                            delete newJF[idx.toString()]
                            setTempJoursFixes(newJF)
                          }}
                          className="text-gray-300 hover:text-red-400 ml-1"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setEditJoursFixesFor(null)}
                  className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={saveJoursFixes}
                  className="flex-1 bg-[#22209C] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#1a1878]"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="lg:grid lg:grid-cols-3 lg:gap-6">
          <div className="lg:col-span-2">
            <PlanningCalendar
              mode="planning"
              vendeuses={vendeuses}
              planningSlots={planningSlots}
              currentMonth={currentMonth}
              planningLoading={planningLoading}
              onNavigate={navigateMonth}
              onAssign={assignSlot}
              onAutoFill={autoFill}
              showAutoFill={true}
              onSaveAll={handleManualSave}
              dailyCA={dailyCA}
              dailyCAByCreneau={dailyCAByCreneau}
            />
          </div>

          {/* Récap heures — sidebar droite */}
          {activeVendeuses.length > 0 && (
            <div className="mt-6 lg:mt-0">
              <div className="bg-white rounded-xl border p-4 sticky top-20">
                <h3 className="text-sm font-bosld text-[#22209C] mb-3">Récap — {monthLabel}</h3>
                <div className="space-y-3">
                  {activeVendeuses.map(v => {
                    const prevues = heuresSupposees(v)
                    const reelles = heuresReelles(v.id)
                    const cp = joursCP(v)
                    const stats = caParVendeuse.get(v.id)
                    const fam = ventesFamilialesParVendeuse.get(v.id)
                    return (
                      <div key={v.id} className="py-3 border-b border-gray-100 last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: v.couleur }} />
                            <span className="text-sm font-bold">{v.prenom.toUpperCase()}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs pl-5">
                          <span>Réel : {Math.round(reelles)}h <span className="text-gray-400">/ {prevues}h prévues</span></span>
                          {cp > 0 && <span className="font-bold">CP : {Math.round(cp)}h</span>}
                        </div>
                        {stats && (
                          <>
                            <div className="flex items-center justify-between text-xs pl-5 mt-0.5">
                              <span>CA : {stats.ca.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                              <span className="font-bold">Bonus : {Math.round(stats.bonus)} €</span>
                            </div>
                            <div className="flex items-center justify-between text-xs pl-5 mt-0.5 text-gray-400">
                              <span>Nb de ventes : {Math.round(stats.ventes)}</span>
                              <span>{reelles > 0 ? (stats.ventes / reelles).toFixed(1) : '0'} ventes/h</span>
                            </div>
                            {stats.discountCount > 0 && (
                              <div className="flex items-center justify-between text-xs pl-5 mt-0.5">
                                <span>Discounts : −{stats.discountTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                                <span className="text-gray-400">{Math.round(stats.discountCount)} discounts</span>
                              </div>
                            )}
                          </>
                        )}
                        {fam && fam.total > 0 && (
                          <div className="pl-5 mt-1 pt-1 border-t border-gray-100">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-pink-600">Ventes familiales</span>
                              <span className="font-bold text-pink-600">
                                {fam.total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5">
                              {fam.count} pièce{fam.count > 1 ? 's' : ''} : {fam.items
                                .map(i => i.sku || i.nom)
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          </div>

        {/* ======================== */}
        {/* SECTION POINTAGES        */}
        {/* ======================== */}
        <PointagesSection
          vendeuses={vendeuses}
          monthKey={monthKey}
          monthLabel={monthLabel}
          planningSlots={planningSlots}
        />
      </div>
    )
  }