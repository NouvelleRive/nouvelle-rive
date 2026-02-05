// app/admin/vendeuses/page.tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, getDoc, setDoc, Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { Plus, X, ChevronLeft, ChevronRight, Wand2 } from 'lucide-react'

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
  // SAUVEGARDER PLANNING
  // =====================
  const savePlanning = async (newSlots: PlanningSlots) => {
    setPlanningSlots(newSlots)
    const docRef = doc(db, 'planning', monthKey)
    await setDoc(docRef, { slots: newSlots }, { merge: true })
  }

  // =====================
  // ASSIGNER UN CRÉNEAU
  // =====================
  const assignSlot = (dateStr: string, creneau: string, vendeuseId: string | '') => {
    const key = `${dateStr}_${creneau}`
    const newSlots = { ...planningSlots }
    if (vendeuseId === '') {
      delete newSlots[key]
    } else {
      newSlots[key] = vendeuseId
    }
    savePlanning(newSlots)
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

      {/* ======================== */}
      {/* CALENDRIER PLANNING      */}
      {/* ======================== */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#22209C]">Planning</h2>
          <button
            onClick={autoFill}
            className="flex items-center gap-2 border border-[#22209C] text-[#22209C] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#22209C] hover:text-white transition"
          >
            <Wand2 size={16} /> Auto-remplir
          </button>
        </div>

        {/* Navigation mois */}
        <div className="flex items-center justify-center gap-6 mb-4">
          <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronLeft size={20} />
          </button>
          <span className="text-lg font-semibold capitalize w-48 text-center">{monthLabel}</span>
          <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Légende vendeuses */}
        <div className="flex flex-wrap gap-3 mb-4 justify-center">
          {activeVendeuses.map(v => (
            <div key={v.id} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: v.couleur }} />
              <span>{v.prenom}</span>
            </div>
          ))}
        </div>

        {/* Grille calendrier */}
        {planningLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#22209C]" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            {/* Header jours */}
            <div className="grid grid-cols-7 border-b bg-gray-50">
              {JOURS_SEMAINE.map((j, i) => (
                <div key={i} className="text-center text-xs font-bold text-gray-500 py-2">
                  {j}
                </div>
              ))}
            </div>

            {/* Jours */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return <div key={`pad-${idx}`} className="border-b border-r min-h-[80px] bg-gray-50/50" />
                }

                const dateStr = `${currentMonth.year}-${(currentMonth.month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
                const isToday = (() => {
                  const now = new Date()
                  return day === now.getDate() && currentMonth.month === now.getMonth() && currentMonth.year === now.getFullYear()
                })()

                return (
                  <div key={dateStr} className={`border-b border-r min-h-[80px] p-1 ${isToday ? 'bg-blue-50' : ''}`}>
                    {/* Numéro du jour */}
                    <div className={`text-xs font-medium mb-1 ${isToday ? 'text-[#22209C] font-bold' : 'text-gray-400'}`}>
                      {day}
                    </div>

                    {/* Créneaux */}
                    {CRENEAUX.map(cr => {
                      const key = `${dateStr}_${cr}`
                      const vendeuseId = planningSlots[key]
                      const v = vendeuseId ? getVendeuse(vendeuseId) : null

                      return (
                        <div key={cr} className="mb-0.5">
                          <select
                            value={vendeuseId || ''}
                            onChange={(e) => assignSlot(dateStr, cr, e.target.value)}
                            className="w-full text-[10px] rounded px-1 py-0.5 border-0 cursor-pointer font-medium"
                            style={{
                              backgroundColor: v ? v.couleur + '20' : 'transparent',
                              color: v ? v.couleur : '#9ca3af',
                            }}
                            title={`${cr}`}
                          >
                            <option value="">{cr}</option>
                            {activeVendeuses.map(av => (
                              <option key={av.id} value={av.id}>
                                {av.prenom}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}