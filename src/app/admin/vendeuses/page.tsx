  // app/admin/vendeuses/page.tsx
  'use client'

  import { format } from 'date-fns'
  import { useEffect, useState, useMemo } from 'react'
  import {
    collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
    serverTimestamp, getDoc, setDoc, Timestamp, onSnapshot
  } from 'firebase/firestore'
  import { db } from '@/lib/firebaseConfig'
  import { Plus, X, ChevronLeft, ChevronRight, Wand2 } from 'lucide-react'
  import PlanningCalendar from '@/components/PlanningCalendar'

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

    // Heures réelles (depuis le planning)
    const heuresReelles = (vendeuseId: string) => {
      let total = 0
      Object.entries(planningSlots).forEach(([key, vid]) => {
        if (vid === vendeuseId) {
          const cr = key.split('_')[1]
          total += heuresCreneau(cr)
        }
      })
      return total
    }

    // CA par vendeuse (réconciliation planning + ventes du mois)
    const caParVendeuse = useMemo(() => {
      const map = new Map<string, { ca: number; ventes: number; bonus: number; discountCount: number; discountTotal: number }>()



      ventesAll.forEach(p => {
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

      // Pass 2 : bonus par créneau
      const ca1220 = new Map<string, number>()
      const ca1117 = new Map<string, number>()

      ventesAll.forEach(p => {
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
      })

      ca1220.forEach((ca, dateStr) => {
        if (ca < 1000) return
        const vendeuseId = planningSlots[`${dateStr}_12-20`]
        if (!vendeuseId) return
        const cur = map.get(vendeuseId)
        if (cur) map.set(vendeuseId, { ...cur, bonus: cur.bonus + ca * 0.01 })
      })

      ca1117.forEach((ca, dateStr) => {
        if (ca < 1000) return
        const vendeuseId = planningSlots[`${dateStr}_11-17`]
        if (!vendeuseId) return
        const cur = map.get(vendeuseId)
        if (cur) map.set(vendeuseId, { ...cur, bonus: cur.bonus + ca * 0.01 })
      })

      return map
    }, [ventesAll, planningSlots, currentMonth])

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
                    return (
                      <div key={v.id} className="py-3 border-b border-gray-100 last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: v.couleur }} />
                            <span className="text-sm font-bold">{v.prenom.toUpperCase()}</span>
                          </div>
                          <span className="text-xs text-gray-400">{prevues}h prévues</span>
                        </div>
                        <div className="flex items-center justify-between text-xs pl-5">
                          <span>Réel : {reelles}h</span>
                          {cp > 0 && <span className="font-bold">CP : {cp}h</span>}
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
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          </div>
      </div>
    )
  }