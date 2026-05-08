'use client'

import { useEffect, useState, useMemo } from 'react'
import { auth, db } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore'
import { UserPlus, Calendar } from 'lucide-react'

type Tab = 'deposante' | 'rdv'

type Deposante = {
  id: string
  prenom?: string
  nom?: string
  email?: string
  telephone?: string
  adresse1?: string
  adresse2?: string
  iban?: string
  bic?: string
  banqueAdresse?: string
  modePaiement?: string
  trigramme?: string
  pieceIdentiteUrl?: string
  contratSigne?: boolean
  contratUrl?: string
  contratSigneAt?: any
  validee?: boolean
  refusee?: boolean
}

type RestockSlot = {
  nom: string
  type: 'chineuse' | 'deposante'
  trigramme?: string
  pieceIds?: string[]
  acceptee?: boolean
  refusee?: boolean
}

type SlotEntry = {
  monthKey: string
  slotKey: string
  dateStr: string
  creneau: string
  slot: RestockSlot
}

function frenchDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function DemandesDepotPage() {
  const [activeTab, setActiveTab] = useState<Tab>('deposante')
  const [deposantes, setDeposantes] = useState<Deposante[]>([])
  const [restockMonths, setRestockMonths] = useState<Record<string, Record<string, RestockSlot>>>({})
  const [pieces, setPieces] = useState<Record<string, any>>({}) // index par id
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string>('')

  // Listener déposantes
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'deposante'), (snap) => {
      setDeposantes(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Listener restocks (3 mois en cours et à venir)
  useEffect(() => {
    const now = new Date()
    const monthKeys: string[] = []
    for (let i = 0; i < 3; i++) {
      const m = new Date(now.getFullYear(), now.getMonth() + i, 1)
      monthKeys.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`)
    }
    const unsubs = monthKeys.map(mk => {
      return onSnapshot(collection(db, 'restocks'), (snap) => {
        // on relit tout, pas grave c'est petit
        const next: Record<string, Record<string, RestockSlot>> = {}
        snap.docs.forEach(d => {
          if (monthKeys.includes(d.id)) {
            next[d.id] = (d.data() as any).slots || {}
          }
        })
        setRestockMonths(next)
      })
    })
    return () => { unsubs.forEach(u => u()) }
  }, [])

  // Charger les pièces référencées dans les RDV en attente (one-shot par changement)
  useEffect(() => {
    const allPieceIds = new Set<string>()
    Object.values(restockMonths).forEach(slots => {
      Object.values(slots).forEach(s => {
        if (s.type === 'deposante' && s.pieceIds) s.pieceIds.forEach(id => allPieceIds.add(id))
      })
    })
    if (allPieceIds.size === 0) return
    ;(async () => {
      const ids = Array.from(allPieceIds)
      // on fetch en chunks de 10 (limite where in)
      const chunks: string[][] = []
      for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10))
      const result: Record<string, any> = { ...pieces }
      for (const chunk of chunks) {
        const snap = await getDocs(query(collection(db, 'produits'), where('__name__', 'in', chunk)))
        snap.docs.forEach(d => { result[d.id] = { id: d.id, ...(d.data() as any) } })
      }
      setPieces(result)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restockMonths])

  const profilsEnAttente = useMemo(
    () => deposantes.filter(d => d.contratSigne === true && !d.validee && !d.refusee),
    [deposantes]
  )
  const deposantesValideesMap = useMemo(() => {
    const m = new Map<string, Deposante>()
    deposantes.forEach(d => { if (d.trigramme) m.set(d.trigramme.toUpperCase(), d) })
    return m
  }, [deposantes])

  const rdvsEnAttente = useMemo<SlotEntry[]>(() => {
    const today = new Date().toISOString().split('T')[0]
    const out: SlotEntry[] = []
    Object.entries(restockMonths).forEach(([monthKey, slots]) => {
      Object.entries(slots).forEach(([slotKey, slot]) => {
        if (slot.type !== 'deposante') return
        if (slot.acceptee === true) return
        if (slot.refusee === true) return
        const dateStr = slotKey.split('_')[0]
        if (dateStr < today) return
        out.push({ monthKey, slotKey, dateStr, creneau: slotKey.split('_')[1], slot })
      })
    })
    return out.sort((a, b) => a.dateStr.localeCompare(b.dateStr))
  }, [restockMonths])

  async function validerDeposante(uid: string, decision: 'valider' | 'refuser') {
    setBusy(uid + '_' + decision)
    try {
      const token = await auth.currentUser?.getIdToken()
      const raison = decision === 'refuser' ? prompt('Raison du refus (optionnelle, sera juste enregistrée):') || '' : ''
      const res = await fetch('/api/deposante/valider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid, decision, raison }),
      })
      const data = await res.json()
      if (!data.success) alert('Erreur : ' + (data.error || 'inconnue'))
    } catch (e: any) {
      alert('Erreur : ' + (e?.message || 'inconnue'))
    } finally {
      setBusy('')
    }
  }

  async function deciderRdv(monthKey: string, slotKey: string, decision: 'accepter' | 'refuser') {
    setBusy(slotKey + '_' + decision)
    try {
      const token = await auth.currentUser?.getIdToken()
      const raison = decision === 'refuser' ? prompt('Raison du refus (envoyée dans le mail):') || '' : ''
      const res = await fetch('/api/deposante/rdv-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ monthKey, slotKey, decision, raison }),
      })
      const data = await res.json()
      if (!data.success) alert('Erreur : ' + (data.error || 'inconnue'))
    } catch (e: any) {
      alert('Erreur : ' + (e?.message || 'inconnue'))
    } finally {
      setBusy('')
    }
  }

  if (loading) return <div className="p-12 text-center text-gray-500">Chargement...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tabs sticky (même layout que /vendeuse/restock) */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('deposante')}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'deposante'
                  ? 'border-[#22209C] text-[#22209C]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <UserPlus size={18} />
              <span>New déposante</span>
              {profilsEnAttente.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-[#22209C] text-white text-xs rounded-full">
                  {profilsEnAttente.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('rdv')}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'rdv'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar size={18} />
              <span>New dépôt / départ</span>
              {rdvsEnAttente.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-amber-600 text-white text-xs rounded-full">
                  {rdvsEnAttente.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

      {activeTab === 'deposante' && (
      <section>
        {profilsEnAttente.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-12">Aucun profil en attente.</p>
        ) : (
          <div className="space-y-3">
            {profilsEnAttente.map(d => (
              <div key={d.id} className="border rounded p-4 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <div><strong>{d.prenom} {d.nom}</strong> ({d.trigramme || '—'})</div>
                  <div>📧 {d.email}</div>
                  <div>📞 {d.telephone}</div>
                  <div>🏠 {d.adresse1} {d.adresse2 ? `· ${d.adresse2}` : ''}</div>
                  <div>💳 IBAN : {d.iban}</div>
                  <div>BIC : {d.bic}</div>
                  <div>Mode paiement : {d.modePaiement === 'cash' ? 'Virement (40%)' : d.modePaiement === 'bon' ? "Bon d'achat (30%)" : '—'}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  {d.pieceIdentiteUrl && <a href={d.pieceIdentiteUrl} target="_blank" rel="noopener noreferrer" className="underline text-[#22209C]">Voir la pièce d'identité</a>}
                  {d.contratUrl && <a href={d.contratUrl} target="_blank" rel="noopener noreferrer" className="underline text-[#22209C]">Voir le contrat signé</a>}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => validerDeposante(d.id, 'valider')}
                    disabled={busy === d.id + '_valider'}
                    className="px-4 py-2 bg-[#22209C] text-white text-xs font-semibold uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
                  >
                    {busy === d.id + '_valider' ? '…' : '✅ Valider'}
                  </button>
                  <button
                    onClick={() => validerDeposante(d.id, 'refuser')}
                    disabled={busy === d.id + '_refuser'}
                    className="px-4 py-2 border border-red-500 text-red-500 text-xs font-semibold uppercase tracking-widest hover:bg-red-50 disabled:opacity-50"
                  >
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      )}

      {activeTab === 'rdv' && (
      <section>
        {rdvsEnAttente.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-12">Aucun RDV en attente.</p>
        ) : (
          <div className="space-y-3">
            {rdvsEnAttente.map(entry => {
              const dep = entry.slot.trigramme ? deposantesValideesMap.get(entry.slot.trigramme.toUpperCase()) : null
              const rdvPieces = (entry.slot.pieceIds || []).map(id => pieces[id]).filter(Boolean)
              return (
                <div key={entry.slotKey} className="border rounded p-4 bg-white">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                    <div>
                      <strong>{dep ? `${dep.prenom} ${dep.nom}` : entry.slot.nom}</strong>
                      <span className="text-gray-400 text-sm ml-2">({entry.slot.trigramme})</span>
                    </div>
                    <div className="text-sm text-[#22209C] font-medium capitalize">{frenchDate(entry.dateStr)} à {entry.creneau}</div>
                  </div>
                  {rdvPieces.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {rdvPieces.map(p => (
                        <div key={p.id} className="border rounded p-2 text-xs">
                          {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full aspect-square object-cover rounded mb-1" />}
                          <div className="font-semibold">{p.sku}</div>
                          <div className="truncate">{(p.nom || '').replace(`${p.sku} - `, '')}</div>
                          <div className="text-gray-500">{(p.categorie || '').replace('DEP - ', '')} · {p.prix} €</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Aucune pièce sélectionnée.</p>
                  )}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => deciderRdv(entry.monthKey, entry.slotKey, 'accepter')}
                      disabled={busy === entry.slotKey + '_accepter'}
                      className="px-4 py-2 bg-[#22209C] text-white text-xs font-semibold uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
                    >
                      {busy === entry.slotKey + '_accepter' ? '…' : '✅ Accepter'}
                    </button>
                    <button
                      onClick={() => deciderRdv(entry.monthKey, entry.slotKey, 'refuser')}
                      disabled={busy === entry.slotKey + '_refuser'}
                      className="px-4 py-2 border border-red-500 text-red-500 text-xs font-semibold uppercase tracking-widest hover:bg-red-50 disabled:opacity-50"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
      )}

      </div>
    </div>
  )
}
