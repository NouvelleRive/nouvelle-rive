// src/app/vendeuse/calendrier/page.tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { collection, getDocs, getDoc, doc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { db, auth } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import PlanningCalendar from '@/components/PlanningCalendar'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

type Vendeuse = { id: string; prenom: string; couleur: string; actif: boolean; joursFixes?: Record<string, string> }
type PlanningSlots = Record<string, string>
type ProduitVente = { id: string; prix?: number; prixVenteReel?: number; dateVente?: Timestamp }
type Produit = { id: string; chineur?: string; chineurUid?: string; createdAt?: Timestamp }
type Deposante = { id: string; nom?: string; trigramme?: string; email?: string }
type Task = { id: string; texte: string }

export default function VendeuseCalendrierPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [vendeuses, setVendeuses] = useState<Vendeuse[]>([])
  const [planningSlots, setPlanningSlots] = useState<PlanningSlots>({})
  const [planningLoading, setPlanningLoading] = useState(false)
  const [ventesAll, setVentesAll] = useState<ProduitVente[]>([])
  const [participants, setParticipants] = useState<{ nom: string; type: 'chineuse' | 'deposante' }[]>([])
  const [deposantes, setDeposantes] = useState<Deposante[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [tasksData, setTasksData] = useState<Record<string, Task[]>>({})
  const [userCompletedTaskIds, setUserCompletedTaskIds] = useState<Set<string>>(new Set())
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const monthKey = useMemo(() =>
    `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`,
    [currentMonth]
  )

  const monthLabel = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (u) { setCurrentUserId(u.uid); setIsAdmin(u.email === ADMIN_EMAIL) }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const fetchAll = async () => {
      const [vendSnap, chinSnap, prodSnap] = await Promise.all([
        getDocs(collection(db, 'vendeuses')),
        getDocs(collection(db, 'chineuse')),
        getDocs(collection(db, 'produits')),
      ])
      setVendeuses(vendSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vendeuse)))
      const deps = chinSnap.docs.map(d => ({ id: d.id, ...d.data() } as Deposante))
      setDeposantes(deps)
      setParticipants(deps.map(d => ({ nom: (d.nom || d.trigramme || '').toUpperCase(), type: 'chineuse' as const })))
      setProduits(prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Produit)))
    }
    fetchAll()
  }, [])

  useEffect(() => {
    const fetchPlanning = async () => {
      setPlanningLoading(true)
      const snap = await getDoc(doc(db, 'planning', monthKey))
      setPlanningSlots(snap.exists() ? snap.data().slots || {} : {})
      setPlanningLoading(false)
    }
    fetchPlanning()
  }, [monthKey])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'ventes'), snap => {
      setVentesAll(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProduitVente)))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const fetchTasks = async () => {
      const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate()
      const taskMap: Record<string, Task[]> = {}
      await Promise.all(
        Array.from({ length: daysInMonth }, (_, i) => i + 1).map(async d => {
          const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const snap = await getDoc(doc(db, 'taches', dateStr))
          if (snap.exists()) taskMap[dateStr] = snap.data().items || []
        })
      )
      setTasksData(taskMap)
    }
    fetchTasks()
  }, [monthKey])

  useEffect(() => {
    if (!currentUserId) return
    const fetchCompletions = async () => {
      const snap = await getDoc(doc(db, 'tachesCompletions', currentUserId))
      if (snap.exists()) {
        const data = snap.data().completed || {}
        setUserCompletedTaskIds(new Set(Object.keys(data).filter(k => data[k])))
      } else {
        setUserCompletedTaskIds(new Set())
      }
    }
    fetchCompletions()
  }, [currentUserId])

  const navigateMonth = (delta: number) => {
    setCurrentMonth(prev => {
      let m = prev.month + delta, y = prev.year
      if (m < 0) { m = 11; y-- }
      if (m > 11) { m = 0; y++ }
      return { year: y, month: m }
    })
  }

  const assignSlot = async (dateStr: string, creneau: string, vendeuseId: string | '') => {
    const key = `${dateStr}_${creneau}`
    const newSlots = { ...planningSlots }
    if (vendeuseId === '') delete newSlots[key]
    else newSlots[key] = vendeuseId
    setPlanningSlots(newSlots)
    await setDoc(doc(db, 'planning', monthKey), { slots: newSlots }, { merge: true })
  }

  const handleAddTask = async (dateStr: string, texte: string) => {
    const existing = tasksData[dateStr] || []
    const newTask: Task = { id: `${dateStr}_${Date.now()}`, texte }
    const newItems = [...existing, newTask]
    setTasksData(prev => ({ ...prev, [dateStr]: newItems }))
    await setDoc(doc(db, 'taches', dateStr), { items: newItems }, { merge: true })
  }

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    if (!currentUserId) return
    const newSet = new Set(userCompletedTaskIds)
    if (completed) newSet.add(taskId)
    else newSet.delete(taskId)
    setUserCompletedTaskIds(newSet)
    const completedMap: Record<string, boolean> = {}
    newSet.forEach(id => { completedMap[id] = true })
    await setDoc(doc(db, 'tachesCompletions', currentUserId), { completed: completedMap })
  }

  const heuresCreneau = (cr: string) => cr === '12-20' ? 8 : cr === '11-17' ? 6 : 0

  const heuresSupposees = (v: Vendeuse) => {
    if (!v.joursFixes) return 0
    const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate()
    let total = 0
    for (let day = 1; day <= daysInMonth; day++) {
      const cr = v.joursFixes[new Date(currentMonth.year, currentMonth.month, day).getDay().toString()]
      if (cr) total += heuresCreneau(cr)
    }
    return total
  }

  const heuresReelles = (vendeuseId: string) => {
    let total = 0
    Object.entries(planningSlots).forEach(([key, vid]) => {
      if (vid === vendeuseId) total += heuresCreneau(key.split('_')[1])
    })
    return total
  }

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
      const addTo = (id: string, f: number) => {
        const cur = map.get(id) || { ca: 0, ventes: 0, bonus: 0, discountCount: 0, discountTotal: 0 }
        map.set(id, { ...cur, ca: cur.ca + montant * f, ventes: cur.ventes + f, discountCount: cur.discountCount + (discount > 0 ? f : 0), discountTotal: cur.discountTotal + discount * f })
      }
      if (slot1117 && slot1220) {
        if (hour < 12) addTo(slot1117, 1)
        else if (hour < 17) { addTo(slot1117, 1); addTo(slot1220, 1) }
        else addTo(slot1220, 1)
      } else { const vid = slot1220 || slot1117; if (vid) addTo(vid, 1) }
    })
    const ca1220 = new Map<string, number>()
    const ca1117 = new Map<string, number>()
    ventesAll.forEach(p => {
      if (!(p.dateVente instanceof Timestamp)) return
      const date = p.dateVente.toDate()
      if (date.getMonth() !== currentMonth.month || date.getFullYear() !== currentMonth.year) return
      const dateStr = format(date, 'yyyy-MM-dd')
      const hour = date.getHours()
      const montant = p.prixVenteReel || 0
      if (hour >= 12 && hour < 20) ca1220.set(dateStr, (ca1220.get(dateStr) || 0) + montant)
      if (hour >= 11 && hour < 17) ca1117.set(dateStr, (ca1117.get(dateStr) || 0) + montant)
    })
    ca1220.forEach((ca, ds) => { if (ca < 1000) return; const vid = planningSlots[`${ds}_12-20`]; if (!vid) return; const cur = map.get(vid); if (cur) map.set(vid, { ...cur, bonus: cur.bonus + ca * 0.01 }) })
    ca1117.forEach((ca, ds) => { if (ca < 1000) return; const vid = planningSlots[`${ds}_11-17`]; if (!vid) return; const cur = map.get(vid); if (cur) map.set(vid, { ...cur, bonus: cur.bonus + ca * 0.01 }) })
    return map
  }, [ventesAll, planningSlots, currentMonth])

  const restockStats = useMemo(() => {
    return [...deposantes].map(d => {
      const mine = produits.filter(p => p.chineur === d.email || p.chineurUid === d.id)
      const dernierRestock = mine.sort((a, b) => (b.createdAt?.toDate?.()?.getTime?.() || 0) - (a.createdAt?.toDate?.()?.getTime?.() || 0))[0]?.createdAt?.toDate?.()
      const joursDepuis = dernierRestock ? Math.floor((Date.now() - dernierRestock.getTime()) / 86400000) : null
      return { d, nbProduits: mine.length, joursDepuis, dernierRestock }
    }).sort((a, b) => (b.joursDepuis ?? 9999) - (a.joursDepuis ?? 9999))
  }, [deposantes, produits])

  const activeVendeuses = vendeuses.filter(v => v.actif)

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="lg:col-span-2">
          <PlanningCalendar
            mode="unified"
            vendeuses={vendeuses}
            planningSlots={planningSlots}
            planningLoading={planningLoading}
            currentMonth={currentMonth}
            onNavigate={navigateMonth}
            onAssign={assignSlot}
            participants={participants}
            userType="admin"
            tasksData={tasksData}
            userCompletedTaskIds={userCompletedTaskIds}
            isAdmin={isAdmin}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
          />
        </div>
        <div className="mt-6 lg:mt-0 space-y-4">
          {activeVendeuses.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-bold mb-3">Vendeuses — {monthLabel}</h3>
              <div className="space-y-3">
                {activeVendeuses.map(v => {
                  const prevues = heuresSupposees(v)
                  const reelles = heuresReelles(v.id)
                  const cp = Math.max(0, prevues - reelles)
                  const stats = caParVendeuse.get(v.id)
                  return (
                    <div key={v.id} className="py-2 border-b border-gray-100 last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold">{v.prenom.toUpperCase()}</span>
                        <span className="text-xs text-gray-400">{prevues}h prévues</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>Réel : {reelles}h</span>
                        {cp > 0 && <span className="font-bold">CP : {cp}h</span>}
                      </div>
                      {stats && <>
                        <div className="flex items-center justify-between text-xs mt-0.5">
                          <span>CA : {stats.ca.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                          <span className="font-bold">Bonus : {Math.round(stats.bonus)} €</span>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-0.5 text-gray-400">
                          <span>{Math.round(stats.ventes)} ventes</span>
                          <span>{reelles > 0 ? (stats.ventes / reelles).toFixed(1) : '0'} /h</span>
                        </div>
                        {stats.discountCount > 0 && (
                          <div className="flex items-center justify-between text-xs mt-0.5">
                            <span>Discounts : −{stats.discountTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                            <span className="text-gray-400">{Math.round(stats.discountCount)}</span>
                          </div>
                        )}
                      </>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-bold mb-3">Restocks</h3>
            <div className="space-y-1">
              {restockStats.map(({ d, nbProduits, joursDepuis, dernierRestock }) => (
                <div key={d.id} className={`flex items-center justify-between py-0.5 text-xs ${nbProduits < 30 || joursDepuis === null || joursDepuis > 30 ? 'text-red-500' : 'text-gray-700'}`}>
                  <span className="font-bold truncate mr-2">{(d.nom || d.trigramme || '').toUpperCase()}</span>
                  <span className="whitespace-nowrap">{nbProduits} art. · {dernierRestock ? dernierRestock.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'jamais'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}