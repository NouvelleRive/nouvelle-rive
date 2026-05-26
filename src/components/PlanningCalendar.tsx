// src/components/PlanningCalendar.tsx
'use client'

import { useMemo, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Wand2, Plus, Check } from 'lucide-react'
import { doc, getDoc, setDoc, updateDoc, getDocs, collection } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'

const CRENEAUX_PLANNING = ['12-20', '11-17'] as const
const CRENEAUX_RESTOCK = ['13h', '16h', '18h'] as const
const JOURS_SEMAINE = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

type Vendeuse = { id: string; prenom: string; couleur: string; actif: boolean }
type Task = { id: string; texte: string }
type PlanningSlots = Record<string, string>
type RestockSlotData = { nom: string; type: 'chineuse' | 'deposante'; trigramme?: string }
type RestockSlots = Record<string, RestockSlotData>
type Participant = { nom: string; type: 'chineuse' | 'deposante'; trigramme?: string }

interface PlanningCalendarProps {
  mode: 'planning' | 'restock' | 'unified'
  vendeuses?: Vendeuse[]
  planningSlots?: PlanningSlots
  planningLoading?: boolean
  onAssign?: (dateStr: string, creneau: string, vendeuseId: string | '') => void
  onAutoFill?: () => void
  showAutoFill?: boolean
  participants?: Participant[]
  userType?: 'admin' | 'chineuse' | 'deposante'
  userNom?: string
  readOnly?: boolean
  tasksData?: Record<string, Task[]>
  userCompletedTaskIds?: Set<string>
  isAdmin?: boolean
  onAddTask?: (dateStr: string, texte: string) => void
  onToggleTask?: (taskId: string, completed: boolean) => void
  currentMonth?: { year: number; month: number }
  onNavigate?: (delta: number) => void
  dailyCA?: Record<string, number>
  dailyCAByCreneau?: Record<string, { '12-20': number; '11-17': number }>
  // Hook optionnel : intercepte la sauvegarde d'un slot restock pour ouvrir une UI custom
  // (ex: déposante qui doit sélectionner des pièces avant de confirmer son RDV).
  // Si la fonction renvoie false, la sauvegarde par défaut est bypassée.
  onRestockSlotPick?: (dateStr: string, creneau: string, val: string) => boolean
  // ID de la vendeuse connectée : si elle se retire d'un de ses propres slots planning,
  // on affiche une modale de confirmation au lieu de sauvegarder direct.
  currentVendeuseId?: string
}

export default function PlanningCalendar({
  mode,
  vendeuses = [],
  planningSlots = {},
  planningLoading = false,
  onAssign,
  onAutoFill,
  showAutoFill = false,
  participants = [],
  userType = 'admin',
  userNom,
  readOnly = false,
  tasksData = {},
  userCompletedTaskIds = new Set(),
  isAdmin = false,
  onAddTask,
  onToggleTask,
  currentMonth: externalMonth,
  onNavigate: externalNavigate,
  dailyCA = {},
  dailyCAByCreneau = {},
  onRestockSlotPick,
  currentVendeuseId = '',
}: PlanningCalendarProps) {

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
        let m = prev.month + delta, y = prev.year
        if (m < 0) { m = 11; y-- }
        if (m > 11) { m = 0; y++ }
        return { year: y, month: m }
      })
    }
  }

  const [restockSlots, setRestockSlots] = useState<RestockSlots>({})
  const [vendeusesRestock, setVendeusesRestock] = useState<Vendeuse[]>([])
  const [planningRestockSlots, setPlanningRestockSlots] = useState<PlanningSlots>({})
  const [restockLoading, setRestockLoading] = useState(false)

  const monthKey = useMemo(() =>
    `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`,
    [currentMonth]
  )

  useEffect(() => {
    if (mode !== 'restock' && mode !== 'unified') return
    const fetch = async () => {
      setRestockLoading(true)
      const snap = await getDoc(doc(db, 'restocks', monthKey))
      setRestockSlots(snap.exists() ? snap.data().slots || {} : {})
      setRestockLoading(false)
    }
    fetch()
  }, [monthKey, mode])

  useEffect(() => {
    if (mode !== 'restock') return
    const fetch = async () => {
      const [vSnap, pSnap] = await Promise.all([
        getDocs(collection(db, 'vendeuses')),
        getDoc(doc(db, 'planning', monthKey))
      ])
      setVendeusesRestock(vSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vendeuse)))
      setPlanningRestockSlots(pSnap.exists() ? pSnap.data().slots || {} : {})
    }
    fetch()
  }, [monthKey, mode])

  const saveRestockSlot = async (dateStr: string, creneau: string, nom: string, type: 'chineuse' | 'deposante' | '', trigramme?: string) => {
    const key = `${dateStr}_${creneau}`
    const newSlots = { ...restockSlots }
    if (!nom) delete newSlots[key]
    else newSlots[key] = { nom, type: type as 'chineuse' | 'deposante', ...(trigramme ? { trigramme } : {}) }
    setRestockSlots(newSlots)
    const ref = doc(db, 'restocks', monthKey)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      // updateDoc remplace le champ slots entièrement (contrairement à setDoc + merge qui fusionne en profondeur)
      await updateDoc(ref, { slots: newSlots })
    } else {
      await setDoc(ref, { slots: newSlots })
    }
    // Notif admin : uniquement quand une chineuse crée/modifie un slot (les déposantes
    // passent par /api/deposante/rdv-demande qui envoie déjà sa propre push).
    if (nom && userType === 'chineuse') {
      try {
        await fetch('/api/notif/annonce-restock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dateStr, creneau, nom, type: 'chineuse' }),
        })
      } catch {}
    }
  }

  const handleRestockChange = (ds: string, cr: string, val: string) => {
    // Hook custom : page peut intercepter (ex: déposante doit pick des pièces)
    if (onRestockSlotPick && val && onRestockSlotPick(ds, cr, val) === false) return
    const participant = participants.find(p => p.nom === val)
    saveRestockSlot(ds, cr, val, participant?.type || 'chineuse', participant?.trigramme)
  }

  const canEditRestock = (slot: RestockSlotData | undefined) => {
    if (readOnly) return false
    if (userType === 'admin') return true
    if (!slot) return true
    return slot.nom === userNom
  }

  const getRestockOptions = (slot: RestockSlotData | undefined): Participant[] => {
    if (userType === 'admin') return participants
    if (!slot && userNom) return [{ nom: userNom, type: userType as 'chineuse' | 'deposante' }]
    if (slot?.nom === userNom && userNom) return [{ nom: userNom, type: userType as 'chineuse' | 'deposante' }]
    return []
  }

  const [addingTaskDate, setAddingTaskDate] = useState<string | null>(null)
  const [newTaskText, setNewTaskText] = useState('')
  const [pendingRemoval, setPendingRemoval] = useState<{ ds: string; cr: string } | null>(null)

  const handlePlanningChange = (ds: string, cr: string, value: string) => {
    const currentValue = planningSlots[`${ds}_${cr}`]
    // Vendeuse non-admin qui se retire d'un de ses propres slots → confirmation
    if (!isAdmin && currentVendeuseId && value === '' && currentValue === currentVendeuseId) {
      setPendingRemoval({ ds, cr })
      return
    }
    onAssign?.(ds, cr, value)
  }

  const confirmRemoval = () => {
    if (!pendingRemoval) return
    onAssign?.(pendingRemoval.ds, pendingRemoval.cr, '')
    setPendingRemoval(null)
  }

  const handleSubmitTask = (dateStr: string) => {
    if (!newTaskText.trim()) return
    onAddTask?.(dateStr, newTaskText.trim())
    setNewTaskText('')
    setAddingTaskDate(null)
  }

  const today = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])

  const currentHour = useMemo(() => new Date().getHours(), [])

  const isCreneauPast = (ds: string, cr: string) => {
    if (ds < today) return true
    if (ds > today) return false
    const h = parseInt(cr.replace(/h.*$/, ''), 10)
    return Number.isFinite(h) && currentHour >= h
  }

  const tasksForDay = useMemo(() => {
    const result: Record<string, (Task & { originalDate: string; isRolled: boolean })[]> = {}
    const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate()
    const lastDayStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    Object.entries(tasksData).forEach(([origDate, tasks]) => {
      tasks.forEach(task => {
        const done = userCompletedTaskIds.has(task.id)
        let effectiveDate: string
        if (done) {
          effectiveDate = origDate
        } else if (origDate <= today) {
          effectiveDate = today <= lastDayStr ? today : lastDayStr
        } else {
          effectiveDate = origDate
        }
        if (!result[effectiveDate]) result[effectiveDate] = []
        result[effectiveDate].push({ ...task, originalDate: origDate, isRolled: effectiveDate !== origDate })
      })
    })
    return result
  }, [tasksData, userCompletedTaskIds, today, currentMonth])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentMonth.year, currentMonth.month, 1)
    const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0)
    const startPad = (firstDay.getDay() + 6) % 7
    const days: (number | null)[] = []
    for (let i = 0; i < startPad; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)
    return days
  }, [currentMonth])

  const monthLabel = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const activeVendeuses = vendeuses.filter(v => v.actif)
  const getVendeuse = (id: string) => vendeuses.find(v => v.id === id)
  const isLoading = mode === 'planning' ? planningLoading : mode === 'restock' ? restockLoading : planningLoading || restockLoading

  const renderPlanningDropdowns = (ds: string) => (
    <>
      {CRENEAUX_PLANNING.map(cr => {
        const vendeuseId = planningSlots[`${ds}_${cr}`]
        const v = vendeuseId ? getVendeuse(vendeuseId) : null
        return (
          <div key={cr} className="mb-0.5">
            <select
              value={vendeuseId || ''}
              onChange={e => handlePlanningChange(ds, cr, e.target.value)}
              className="w-full text-[10px] rounded px-1 py-0.5 border-0 cursor-pointer font-medium"
              style={{ backgroundColor: v ? v.couleur + '20' : 'transparent', color: v ? v.couleur : '#9ca3af' }}
              title={cr}
            >
              <option value="">{v ? '— Retirer —' : cr}</option>
              {activeVendeuses.map(av => <option key={av.id} value={av.id}>{av.prenom}</option>)}
            </select>
          </div>
        )
      })}
    </>
  )

  const renderRestockDropdowns = (ds: string, usePlanningSlots = false) => {
    const [y, m, d] = ds.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    const isWeekend = dow === 0 || dow === 6
    // Week-end : autorisé uniquement pour les déposantes (la boutique reste fermée pour les
    // chineuses le week-end, donc on n'affiche pas de créneaux pour elles).
    if (isWeekend && userType !== 'deposante') return null
    const creneaux: string[] = dow === 2 ? ['13h', '16h', '18h'] : ['13h', '16h']
    const slots = usePlanningSlots ? planningSlots : planningRestockSlots
    const vList = usePlanningSlots ? vendeuses : vendeusesRestock
    const noms = ['12-20', '11-17']
      .map(cr => slots[`${ds}_${cr}`])
      .filter(Boolean)
      .map(id => vList.find(v => v.id === id)?.prenom)
      .filter(Boolean)
    const nomsUniques = [...new Set(noms)]

    return (
      <>
        
        {creneaux.map(cr => {
          const key = `${ds}_${cr}`
          const slot = restockSlots[key]
          const past = isCreneauPast(ds, cr)
          const editable = canEditRestock(slot) && !(past && userType !== 'admin')
          const options = getRestockOptions(slot)
          const isDeposante = slot?.type === 'deposante'
          const isMine = slot && userNom && slot.nom === userNom
          const slotColors = isDeposante
            ? 'text-orange-700 bg-orange-50'
            : 'text-gray-700 bg-gray-50'
          // Chineuses : voient tous les slots (les leurs éditables, les autres en lecture
          // seule) pour pouvoir s'organiser entre elles. Déposantes : seul leur propre RDV
          // et les créneaux libres sont visibles.
          const isOtherSlot = userType !== 'admin' && slot && !isMine
          if (isOtherSlot && userType === 'deposante') return null
          // Pour les déposantes/chineuses, les créneaux passés vides sont cachés
          if (past && userType !== 'admin' && !slot) return null
          return (
            <div key={cr} className="mb-0.5">
              {editable && options.length > 0 ? (
                <select
                  value={slot?.nom || ''}
                  onChange={e => handleRestockChange(ds, cr, e.target.value)}
                  className={`w-full text-[10px] rounded px-1 py-0.5 cursor-pointer font-semibold border ${
                    slot
                      ? `${slotColors} border-transparent`
                      : 'bg-white text-[#22209C] border-[#22209C] hover:bg-[#22209C]/5'
                  }`}
                  title={cr}
                >
                  <option value="">{cr}</option>
                  {options.map((p, i) => <option key={i} value={p.nom}>{p.nom}</option>)}
                </select>
              ) : (
                <div className={`w-full text-[10px] rounded px-1 py-0.5 font-medium truncate ${past ? 'text-gray-300 bg-gray-50 line-through opacity-60' : slot ? slotColors : 'text-gray-700 bg-gray-50'}`} title={slot ? `${slot.nom}${isDeposante ? ' (déposante)' : ''}${past ? ' — passé' : ''}` : cr}>
                  {slot ? <>{isDeposante && '◆ '}{slot.nom}</> : <span className="text-gray-300">{cr}</span>}
                </div>
              )}
            </div>
          )
        })}
      </>
    )
  }

  const renderUnifiedCell = (ds: string) => {
    const dayTasks = tasksForDay[ds] || []
    return (
      <>
        {renderPlanningDropdowns(ds)}
        <div className="border-t border-gray-100 my-0.5" />
        {renderRestockDropdowns(ds, true)}
        {dayTasks.length > 0 && <div className="border-t border-gray-100 my-0.5" />}
        {dayTasks.map(task => {
          const done = userCompletedTaskIds.has(task.id)
          return (
            <button
              key={task.id}
              onClick={() => onToggleTask?.(task.id, !done)}
              className={`w-full text-left text-[9px] rounded px-1 py-0.5 mb-0.5 flex items-center gap-0.5 transition-colors ${
                done ? 'bg-green-100 text-green-700' : task.isRolled ? 'bg-orange-100 text-orange-700' : 'bg-orange-50 text-orange-500'
              }`}
              title={task.isRolled ? `Reportée depuis le ${task.originalDate}` : task.texte}
            >
              <span className={`w-2.5 h-2.5 rounded-full border flex-shrink-0 flex items-center justify-center ${done ? 'bg-green-500 border-green-500' : 'border-current'}`}>
                {done && <Check size={6} className="text-white" />}
              </span>
              <span className={`truncate ${done ? 'line-through' : ''}`}>{task.texte}</span>
            </button>
          )
        })}
        {isAdmin && (
          addingTaskDate === ds ? (
            <input
              autoFocus
              type="text"
              value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSubmitTask(ds)
                if (e.key === 'Escape') { setAddingTaskDate(null); setNewTaskText('') }
              }}
              onBlur={() => newTaskText.trim() ? handleSubmitTask(ds) : setAddingTaskDate(null)}
              placeholder="Tâche..."
              className="w-full text-[9px] border rounded px-1 py-0.5 outline-none mt-0.5"
            />
          ) : (
            <button
              onClick={() => setAddingTaskDate(ds)}
              className="w-full text-[9px] text-gray-300 hover:text-gray-500 flex items-center gap-0.5 mt-0.5 transition-colors"
            >
              <Plus size={8} /> tâche
            </button>
          )
        )}
      </>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div />
        {mode === 'planning' && showAutoFill && onAutoFill && (
          <button onClick={onAutoFill} className="flex items-center gap-2 border border-[#22209C] text-[#22209C] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#22209C] hover:text-white transition">
            <Wand2 size={16} /> Auto-remplir
          </button>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 mb-4">
        <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition"><ChevronLeft size={20} /></button>
        <span className="text-lg font-semibold capitalize w-48 text-center">{monthLabel}</span>
        <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg transition"><ChevronRight size={20} /></button>
      </div>

      {(mode === 'planning' || mode === 'unified') && (
        <div className="flex flex-wrap gap-3 mb-4 justify-center">
          {activeVendeuses.map(v => (
            <div key={v.id} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: v.couleur }} />
              <span>{v.prenom}</span>
            </div>
          ))}
          {mode === 'unified' && <>
            <div className="flex items-center gap-1.5 text-xs text-red-500"><div className="w-3 h-3 rounded bg-red-100" /><span>Tâche</span></div>
            <div className="flex items-center gap-1.5 text-xs text-green-600"><div className="w-3 h-3 rounded bg-green-100" /><span>Fait</span></div>
          </>}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#22209C]" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-7 border-b bg-gray-50">
              {JOURS_SEMAINE.map((j, i) => <div key={i} className="text-center text-xs font-bold text-gray-500 py-2">{j}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`pad-${idx}`} className="border-b border-r min-h-[100px] bg-gray-50/50" />
                const ds = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const now = new Date()
                const isToday = day === now.getDate() && currentMonth.month === now.getMonth() && currentMonth.year === now.getFullYear()

                return (
                  <div key={ds} className={`border-b border-r min-h-[100px] p-1 ${isToday ? 'bg-blue-50' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
  <span className={`text-xs font-medium ${isToday ? 'text-[#22209C] font-bold' : 'text-gray-400'}`}>{day}</span>
  {dailyCA[ds] !== undefined && (
    <div className="text-right">
      <div className={`text-[9px] font-semibold ${dailyCA[ds] >= 1000 ? 'text-green-600' : 'text-red-400'}`}>
        {dailyCA[ds].toLocaleString('fr-FR')}€
      </div>
      {dailyCAByCreneau[ds] && (
        <div className="flex gap-1 justify-end">
          <span className={`text-[8px] ${dailyCAByCreneau[ds]['12-20'] >= 1000 ? 'text-green-500' : 'text-red-300'}`}>
            ▸{Math.round(dailyCAByCreneau[ds]['12-20'])}€
          </span>
          <span className={`text-[8px] ${dailyCAByCreneau[ds]['11-17'] >= 1000 ? 'text-green-500' : 'text-red-300'}`}>
            ▸{Math.round(dailyCAByCreneau[ds]['11-17'])}€
          </span>
        </div>
      )}
    </div>
  )}
</div>
                    {mode === 'planning' && renderPlanningDropdowns(ds)}
                    {mode === 'restock' && renderRestockDropdowns(ds, false)}
                    {mode === 'unified' && renderUnifiedCell(ds)}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {pendingRemoval && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setPendingRemoval(null)}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold mb-1">Tu dois trouver ta remplaçante !</h3>
            <p className="text-sm text-gray-500 mb-5">(même si elle sera pas aussi belle)</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPendingRemoval(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={confirmRemoval}
                className="px-4 py-2 text-sm bg-[#22209C] text-white rounded-lg hover:bg-[#22209C]/90 font-medium"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}