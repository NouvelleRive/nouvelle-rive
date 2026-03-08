'use client'

import { useMemo, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Wand2 } from 'lucide-react'
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'



// =====================
// CONSTANTES
// =====================
const CRENEAUX_PLANNING = ['12-20', '11-17'] as const
const CRENEAUX_RESTOCK = ['14h', '18h'] as const
const JOURS_SEMAINE = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// =====================
// TYPES
// =====================
type Vendeuse = {
  id: string
  prenom: string
  couleur: string
  actif: boolean
}

type PlanningSlots = Record<string, string>

type RestockSlotData = { nom: string; type: 'chineuse' | 'deposante' }
type RestockSlots = Record<string, RestockSlotData>

type Participant = {
  nom: string
  type: 'chineuse' | 'deposante'
}

// =====================
// PROPS
// =====================
interface PlanningCalendarProps {
  mode: 'planning' | 'restock'

  // --- mode planning ---
  vendeuses?: Vendeuse[]
  planningSlots?: PlanningSlots
  planningLoading?: boolean
  onAssign?: (dateStr: string, creneau: string, vendeuseId: string | '') => void
  onAutoFill?: () => void
  showAutoFill?: boolean

  // --- mode restock ---
  participants?: Participant[]           // liste complète (admin) ou vide (chineuse/deposante)
  userType?: 'admin' | 'chineuse' | 'deposante'
  userNom?: string                       // nom de l'utilisateur connecté
  readOnly?: boolean                     // deposante : voit juste les dispos

  // --- commun ---
  currentMonth?: { year: number; month: number }
  onNavigate?: (delta: number) => void   // si navigation gérée par le parent
}

// =====================
// COMPOSANT
// =====================
export default function PlanningCalendar({
  mode,

  // planning
  vendeuses = [],
  planningSlots = {},
  planningLoading = false,
  onAssign,
  onAutoFill,
  showAutoFill = false,

  // restock
  participants = [],
  userType = 'admin',
  userNom,
  readOnly = false,

  // commun
  currentMonth: externalMonth,
  onNavigate: externalNavigate,
}: PlanningCalendarProps) {

  // Navigation interne (mode restock) ou externe (mode planning)
  const [internalMonth, setInternalMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const currentMonth = externalMonth ?? internalMonth

  const navigateMonth = (delta: number) => {
    if (externalNavigate) {
      externalNavigate(delta)
    } else {
      setInternalMonth(prev => {
        let m = prev.month + delta
        let y = prev.year
        if (m < 0) { m = 11; y-- }
        if (m > 11) { m = 0; y++ }
        return { year: y, month: m }
      })
    }
  }

  // =====================
  // RESTOCK — Firestore interne
  // =====================
  const [restockSlots, setRestockSlots] = useState<RestockSlots>({})
  const [vendeusesRestock, setVendeusesRestock] = useState<Vendeuse[]>([])
  const [planningRestockSlots, setPlanningRestockSlots] = useState<PlanningSlots>({})
  const [restockLoading, setRestockLoading] = useState(false)

  const monthKey = useMemo(() => {
    return `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`
  }, [currentMonth])

  useEffect(() => {
    if (mode !== 'restock') return
    const fetchRestocks = async () => {
      setRestockLoading(true)
      const snap = await getDoc(doc(db, 'restocks', monthKey))
      if (snap.exists()) setRestockSlots(snap.data().slots || {})
      else setRestockSlots({})
      setRestockLoading(false)
    }
    fetchRestocks()
  }, [monthKey, mode])

  useEffect(() => {
    if (mode !== 'restock') return
    const fetchPlanningData = async () => {
      const [vSnap, pSnap] = await Promise.all([
        getDocs(collection(db, 'vendeuses')),
        getDoc(doc(db, 'planning', monthKey))
      ])
      setVendeusesRestock(vSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vendeuse)))
      setPlanningRestockSlots(pSnap.exists() ? pSnap.data().slots || {} : {})
    }
    fetchPlanningData()
  }, [monthKey, mode])

  const saveRestockSlot = async (dateStr: string, creneau: string, nom: string, type: 'chineuse' | 'deposante' | '') => {
    const key = `${dateStr}_${creneau}`
    const newSlots = { ...restockSlots }
    if (!nom) delete newSlots[key]
    else newSlots[key] = { nom, type: type as 'chineuse' | 'deposante' }
    setRestockSlots(newSlots)
    await setDoc(doc(db, 'restocks', monthKey), { slots: newSlots }, { merge: true })
  }

  const handleRestockChange = (ds: string, cr: string, val: string) => {
    const participant = participants.find(p => p.nom === val)
    saveRestockSlot(ds, cr, val, participant?.type || 'chineuse')
  }

  const canEditRestock = (slot: RestockSlotData | undefined): boolean => {
    if (readOnly) return false
    if (userType === 'admin') return true
    if (!slot) return true           // créneau vide → peut booker
    return slot.nom === userNom      // son propre slot → peut se retirer
  }

  const getRestockOptions = (slot: RestockSlotData | undefined): Participant[] => {
    if (userType === 'admin') return participants
    if (!slot && userNom) return [{ nom: userNom, type: userType as 'chineuse' | 'deposante' }]
    if (slot?.nom === userNom && userNom) return [{ nom: userNom, type: userType as 'chineuse' | 'deposante' }]
    return []
  }

  // =====================
  // CALENDRIER COMMUN
  // =====================
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentMonth.year, currentMonth.month, 1)
    const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0)
    const startPad = (firstDay.getDay() + 6) % 7
    const days: (number | null)[] = []
    for (let i = 0; i < startPad; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)
    return days
  }, [currentMonth])

  const monthLabel = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('fr-FR', {
    month: 'long', year: 'numeric'
  })

  const activeVendeuses = vendeuses.filter(v => v.actif)
  const getVendeuse = (id: string) => vendeuses.find(v => v.id === id)

  const isLoading = mode === 'planning' ? planningLoading : restockLoading

  // =====================
  // RENDER CELLULE PLANNING
  // =====================
  const renderPlanningCell = (ds: string) => (
    <>
      {CRENEAUX_PLANNING.map(cr => {
        const key = `${ds}_${cr}`
        const vendeuseId = planningSlots[key]
        const v = vendeuseId ? getVendeuse(vendeuseId) : null
        return (
          <div key={cr} className="mb-0.5">
            <select
              value={vendeuseId || ''}
              onChange={(e) => onAssign?.(ds, cr, e.target.value)}
              className="w-full text-[10px] rounded px-1 py-0.5 border-0 cursor-pointer font-medium"
              style={{
                backgroundColor: v ? v.couleur + '20' : 'transparent',
                color: v ? v.couleur : '#9ca3af',
              }}
              title={cr}
            >
              <option value="">{cr}</option>
              {activeVendeuses.map(av => (
                <option key={av.id} value={av.id}>{av.prenom}</option>
              ))}
            </select>
          </div>
        )
      })}
    </>
  )

  // =====================
  // RENDER CELLULE RESTOCK
  // =====================
  const renderRestockCell = (ds: string, isWeekend: boolean) => {
    if (isWeekend) return <p className="text-[8px] text-gray-300 leading-tight">Fermé</p>
    const v1220 = planningRestockSlots[`${ds}_12-20`]
    const v1117 = planningRestockSlots[`${ds}_11-17`]
    const noms = [v1220, v1117]
      .filter(Boolean)
      .map(id => vendeusesRestock.find(v => v.id === id))
      .filter(Boolean)
      .map(v => v!.prenom)
    const nomsUniques = [...new Set(noms)]
    return (
      <>
        {CRENEAUX_RESTOCK.map(cr => {
          const key = `${ds}_${cr}`
          const slot = restockSlots[key]
          const editable = canEditRestock(slot)
          const options = getRestockOptions(slot)
          const color = slot ? (slot.type === 'chineuse' ? '#22209C' : '#16a34a') : '#9ca3af'
          const bg = slot ? (slot.type === 'chineuse' ? '#22209C20' : '#22c55e20') : 'transparent'
          return (
            <div key={cr} className="mb-0.5">
              {editable && options.length > 0 ? (
                <select
                  value={slot?.nom || ''}
                  onChange={(e) => handleRestockChange(ds, cr, e.target.value)}
                  className="w-full text-[10px] rounded px-1 py-0.5 border-0 cursor-pointer font-medium"
                  style={{ backgroundColor: bg, color }}
                  title={cr}
                >
                  <option value="">{cr}</option>
                  {options.map((p, i) => (
                    <option key={i} value={p.nom}>{p.nom}</option>
                  ))}
                </select>
              ) : (
                <div
                  className="w-full text-[10px] rounded px-1 py-0.5 font-medium truncate"
                  style={{ backgroundColor: bg, color }}
                  title={slot?.nom || cr}
                >
                  {slot ? slot.nom : <span style={{ color: '#d1d5db' }}>{cr}</span>}
                </div>
              )}
            </div>
          )
        })}
      </>
    )
  }

  // =====================
  // RENDER
  // =====================
  return (
    <div>
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <div />
        {mode === 'planning' && showAutoFill && onAutoFill && (
          <button
            onClick={onAutoFill}
            className="flex items-center gap-2 border border-[#22209C] text-[#22209C] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#22209C] hover:text-white transition"
          >
            <Wand2 size={16} /> Auto-remplir
          </button>
        )}
      </div>

      {/* NAVIGATION MOIS */}
      <div className="flex items-center justify-center gap-6 mb-4">
        <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft size={20} />
        </button>
        <span className="text-lg font-semibold capitalize w-48 text-center">{monthLabel}</span>
        <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* LÉGENDE */}
      <div className="flex flex-wrap gap-3 mb-4 justify-center">
        {mode === 'planning' && activeVendeuses.map(v => (
          <div key={v.id} className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: v.couleur }} />
            <span>{v.prenom}</span>
          </div>
        ))}
        {mode === 'restock' && (
          <>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-full bg-[#22209C]" />
              <span>Chineuse</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Déposante</span>
            </div>
          </>
        )}
      </div>

      {/* CALENDRIER */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#22209C]" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-gray-50">
            {JOURS_SEMAINE.map((j, i) => (
              <div key={i} className="text-center text-xs font-bold text-gray-500 py-2">{j}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <div key={`pad-${idx}`} className="border-b border-r min-h-[80px] bg-gray-50/50" />
              }
              const ds = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const now = new Date()
              const isToday = day === now.getDate() && currentMonth.month === now.getMonth() && currentMonth.year === now.getFullYear()
              const dow = new Date(currentMonth.year, currentMonth.month, day).getDay()
              const isWeekend = dow === 0 || dow === 6

              return (
                <div
                  key={ds}
                  className={`border-b border-r min-h-[80px] p-1 ${isToday ? 'bg-blue-50' : ''} ${mode === 'restock' && isWeekend ? 'bg-gray-50/70' : ''}`}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-[#22209C] font-bold' : 'text-gray-400'}`}>
                    {day}
                  </div>
                  {mode === 'planning'
                    ? renderPlanningCell(ds)
                    : renderRestockCell(ds, isWeekend)
                  }
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}