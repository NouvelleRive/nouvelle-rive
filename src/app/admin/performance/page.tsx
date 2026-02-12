// app/admin/performance/page.tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { db } from '@/lib/firebaseConfig'
import { collection, onSnapshot, Timestamp, doc, getDoc } from 'firebase/firestore'
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceArea, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown, Users, ShoppingBag, Euro, Award, Calendar, Zap, Star } from 'lucide-react'
import Link from 'next/link'
import { getMonthEvents } from '@/lib/retailEvents'

type Produit = {
  id: string
  nom?: string
  sku?: string
  prix?: number
  prixVenteReel?: number
  chineur?: string
  chinpieces?: string
  categorie?: any
  vendu?: boolean
  quantite?: number
  statut?: string
  dateVente?: Timestamp
  dateEntree?: Timestamp
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

type Deposant = {
  id: string
  email: string
  nom?: string
  trigramme?: string
  type?: string
  taux?: number
  'Catégorie de rapport'?: { taux?: number }[]
}

type VendeusePerf = {
  id: string
  prenom: string
  couleur: string
} 

const moisLabels = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const moisCourt = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

export default function PerformancePage() {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [showAllChineuses, setShowAllChineuses] = useState(false)
  const [produits, setProduits] = useState<Produit[]>([])
  const [deposants, setDeposants] = useState<Deposant[]>([])
  const [loading, setLoading] = useState(true)
  const [vendeusesList, setVendeusesList] = useState<VendeusePerf[]>([])
  const [planningSlots, setPlanningSlots] = useState<Record<string, string>>({})

  // Charger les déposants
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'chineuse'), (snap) => {
      setDeposants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Deposant)))
    })
    return () => unsub()
  }, [])

  // Charger TOUS les produits
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'produits'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Produit))
      setProduits(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Charger les vendeuses
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vendeuses'), (snap) => {
      setVendeusesList(snap.docs.map(d => ({ id: d.id, ...d.data() } as VendeusePerf)))
    })
    return () => unsub()
  }, [])

  // Charger le planning du mois sélectionné
  useEffect(() => {
    const fetchPlanning = async () => {
      const mKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`
      const snap = await getDoc(doc(db, 'planning', mKey))
      setPlanningSlots(snap.exists() ? (snap.data().slots || {}) : {})
    }
    fetchPlanning()
  }, [selectedMonth, selectedYear])

  // Générer tous les mois disponibles depuis les données
  const availableMonths = useMemo(() => {
    const months: { year: number; month: number; label: string }[] = []
    // Partir de 2024 janvier jusqu'au mois courant
    const startYear = 2024
    for (let y = startYear; y <= now.getFullYear(); y++) {
      const maxMonth = y === now.getFullYear() ? now.getMonth() : 11
      for (let m = 0; m <= maxMonth; m++) {
        months.push({ year: y, month: m, label: `${moisCourt[m]} ${y}` })
      }
    }
    return months.reverse() // Plus récent en premier
  }, [])

  // Filtrer les ventes (produits vendus)
  const ventes = useMemo(() => {
    return produits.filter(p => 
      p.vendu === true || 
      p.statut === 'vendu' || 
      (p.quantite !== undefined && p.quantite <= 0)
    )
  }, [produits])

  // Filtrer par mois
  const currentMonthStart = startOfMonth(new Date(selectedYear, selectedMonth))
  const currentMonthEnd = endOfMonth(new Date(selectedYear, selectedMonth))
  const previousMonthStart = startOfMonth(subMonths(currentMonthStart, 1))
  const previousMonthEnd = endOfMonth(subMonths(currentMonthStart, 1))

  // Helper pour obtenir la date de vente
  const getDateVente = (p: Produit): Date | null => {
    if (p.dateVente instanceof Timestamp) return p.dateVente.toDate()
    if (p.updatedAt instanceof Timestamp) return p.updatedAt.toDate()
    if (p.createdAt instanceof Timestamp) return p.createdAt.toDate()
    return null
  }

  // Helper pour obtenir la date d'entrée
  const getDateEntree = (p: Produit): Date | null => {
    if (p.dateEntree instanceof Timestamp) return p.dateEntree.toDate()
    if (p.createdAt instanceof Timestamp) return p.createdAt.toDate()
    return null
  }

  const ventesCurrentMonth = useMemo(() => {
    return ventes.filter(v => {
      const date = getDateVente(v)
      if (!date) return false
      return date >= currentMonthStart && date <= currentMonthEnd
    })
  }, [ventes, currentMonthStart, currentMonthEnd])

  const ventesPreviousMonth = useMemo(() => {
    return ventes.filter(v => {
      const date = getDateVente(v)
      if (!date) return false
      return date >= previousMonthStart && date <= previousMonthEnd
    })
  }, [ventes, previousMonthStart, previousMonthEnd])

  // KPIs
  const totalCA = ventesCurrentMonth.reduce((sum, v) => sum + (v.prixVenteReel || v.prix || 0), 0)
  const totalVentes = ventesCurrentMonth.length
  const previousCA = ventesPreviousMonth.reduce((sum, v) => sum + (v.prixVenteReel || v.prix || 0), 0)
  const previousVentes = ventesPreviousMonth.length

  const caEvolution = previousCA > 0 ? ((totalCA - previousCA) / previousCA * 100).toFixed(1) : null
  const ventesEvolution = previousVentes > 0 ? ((totalVentes - previousVentes) / previousVentes * 100).toFixed(1) : null
  const panierMoyen = totalVentes > 0 ? Math.round(totalCA / totalVentes) : 0
  const previousPanierMoyen = previousVentes > 0 ? Math.round(previousCA / previousVentes) : 0
  const panierEvolution = previousPanierMoyen > 0 
    ? ((panierMoyen - previousPanierMoyen) / previousPanierMoyen * 100).toFixed(1) 
    : null

  // CA par jour
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: currentMonthStart, end: currentMonthEnd })
    const previousDays = eachDayOfInterval({ start: previousMonthStart, end: previousMonthEnd })

    return days.map((day, index) => {
      const dayStr = format(day, 'yyyy-MM-dd')
      const caJour = ventesCurrentMonth
        .filter(v => {
          const d = getDateVente(v)
          return d && format(d, 'yyyy-MM-dd') === dayStr
        })
        .reduce((sum, v) => sum + (v.prixVenteReel || v.prix || 0), 0)

      const prevDay = previousDays[index]
      const prevDayStr = prevDay ? format(prevDay, 'yyyy-MM-dd') : ''
      const caPrecedent = prevDay ? ventesPreviousMonth
        .filter(v => {
          const d = getDateVente(v)
          return d && format(d, 'yyyy-MM-dd') === prevDayStr
        })
        .reduce((sum, v) => sum + (v.prixVenteReel || v.prix || 0), 0) : 0

      return {
        jour: index + 1,
        date: format(day, 'd/M'),
        ca: caJour,
        caPrecedent,
      }
    })
  }, [ventesCurrentMonth, ventesPreviousMonth, currentMonthStart, currentMonthEnd, previousMonthStart, previousMonthEnd])

  // Résoudre le nom d'une chineuse (grouper par ID déposant, pas par email)
  const resolveChineuse = (email: string) => {
    const dep = deposants.find(d => d.email === email)
    return dep?.id || email // On groupe par ID si trouvé, sinon par email
  }

  const getChineuseDisplayName = (chineuseKey: string) => {
    // Chercher par ID d'abord, puis par email
    const dep = deposants.find(d => d.id === chineuseKey) || deposants.find(d => d.email === chineuseKey)
    if (dep?.nom) return dep.nom
    if (dep?.email) return dep.email.split('@')[0].charAt(0).toUpperCase() + dep.email.split('@')[0].slice(1)
    if (chineuseKey.includes('@')) return chineuseKey.split('@')[0].charAt(0).toUpperCase() + chineuseKey.split('@')[0].slice(1)
    return chineuseKey
  }

  const getChineuseTrigramme = (chineuseKey: string) => {
    const dep = deposants.find(d => d.id === chineuseKey) || deposants.find(d => d.email === chineuseKey)
    return dep?.trigramme || chineuseKey.substring(0, 3).toUpperCase()
  }

  // Classement chineuses - groupé par trigramme
  const classementChineuses = useMemo(() => {
    const map = new Map<string, { ca: number; ventes: number }>()
    
    ventesCurrentMonth.forEach(v => {
      const tri = (v as any).trigramme || 'unknown'
      const current = map.get(tri) || { ca: 0, ventes: 0 }
      map.set(tri, {
        ca: current.ca + (v.prixVenteReel || v.prix || 0),
        ventes: current.ventes + 1,
      })
    })

    return Array.from(map.entries())
      .map(([tri, data]) => {
        const dep = deposants.find(d => d.trigramme === tri)
        const isNR = tri === 'NR'
        const taux = dep?.['Catégorie de rapport']?.[0]?.taux ?? dep?.taux ?? 0
        const benef = isNR ? data.ca : Math.round(data.ca * taux / 100)
        return {
          key: tri,
          nom: dep?.nom || tri,
          trigramme: tri,
          benef,
          isNR,
          ...data,
        }
      })
      .filter(c => c.key !== 'unknown')
      .sort((a, b) => b.ca - a.ca)
  }, [ventesCurrentMonth, deposants])

  // Top catégories
  const topCategories = useMemo(() => {
    const map = new Map<string, { ca: number; count: number }>()
    
    ventesCurrentMonth.forEach(v => {
      const cat = typeof v.categorie === 'object' ? v.categorie?.label : v.categorie || 'Autre'
      const current = map.get(cat) || { ca: 0, count: 0 }
      map.set(cat, { ca: current.ca + (v.prixVenteReel || v.prix || 0), count: current.count + 1 })
    })

    const sorted = Array.from(map.entries()).sort((a, b) => b[1].ca - a[1].ca).slice(0, 15)
    const maxCA = sorted[0]?.[1].ca || 1

    return sorted.map(([cat, data]) => ({
      cat,
      ca: data.ca,
      count: data.count,
      pct: Math.round((data.ca / maxCA) * 100),
    }))
  }, [ventesCurrentMonth])

  // Top Fast Sellers - pièces vendues le plus vite
  const topFastSellers = useMemo(() => {
    return ventesCurrentMonth
      .map(v => {
        const dateVente = getDateVente(v)
        const dateEntree = getDateEntree(v)
        if (!dateVente || !dateEntree) return null
        const jours = differenceInDays(dateVente, dateEntree)
        if (jours < 0) return null
        const photos = (v as any).photos || {}
        const photo = photos.face || photos.main || Object.values(photos).find((p: any) => typeof p === 'string' && p.startsWith('http')) || null
        return {
          id: v.id,
          nom: v.nom || v.sku || 'Sans nom',
          prix: v.prixVenteReel || v.prix || 0,
          jours,
          dateVente,
          photo: photo as string | null,
        }
      })
      .filter(Boolean)
      .sort((a, b) => a!.jours - b!.jours)
      .slice(0, 20) as { id: string; nom: string; prix: number; jours: number; dateVente: Date; photo: string | null }[]
  }, [ventesCurrentMonth])

  // Moyenne CA par jour de la semaine (filtré par mois sélectionné)
  const bestWeekdays = useMemo(() => {
    const joursSemaine = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
    const days = eachDayOfInterval({ start: currentMonthStart, end: currentMonthEnd })
    const dayCountInMonth = new Map<number, number>()
    days.forEach(d => {
      const dow = d.getDay()
      dayCountInMonth.set(dow, (dayCountInMonth.get(dow) || 0) + 1)
    })

    const map = new Map<number, { ca: number; count: number }>()
    ventesCurrentMonth.forEach(v => {
      const date = getDateVente(v)
      if (!date) return
      const dow = date.getDay()
      const current = map.get(dow) || { ca: 0, count: 0 }
      map.set(dow, {
        ca: current.ca + (v.prixVenteReel || v.prix || 0),
        count: current.count + 1,
      })
    })

    return Array.from(map.entries())
      .map(([dow, data]) => ({
        dow,
        label: joursSemaine[dow],
        ca: data.ca,
        moyenne: Math.round(data.ca / (dayCountInMonth.get(dow) || 1)),
        count: data.count,
      }))
      .sort((a, b) => b.moyenne - a.moyenne)
  }, [ventesCurrentMonth, currentMonthStart, currentMonthEnd])

  // Meilleures heures de vente
  const bestHours = useMemo(() => {
    const hourMap = new Map<number, { ca: number; count: number }>()
    
    ventesCurrentMonth.forEach(v => {
      const date = getDateVente(v)
      if (!date) return
      const hour = date.getHours()
      const current = hourMap.get(hour) || { ca: 0, count: 0 }
      hourMap.set(hour, {
        ca: current.ca + (v.prixVenteReel || v.prix || 0),
        count: current.count + 1,
      })
    })

    return Array.from(hourMap.entries())
      .map(([hour, data]) => ({ hour, ...data }))
      .sort((a, b) => b.count - a.count)
  }, [ventesCurrentMonth])

  const monthEvents = useMemo(() => getMonthEvents(selectedMonth, selectedYear), [selectedMonth, selectedYear])

  const prixParTranche = useMemo(() => {
    const tranches = [
      [0,50],[50,100],[100,200],[200,300],[300,400],[400,500],
      [500,600],[600,700],[700,800],[800,900],[900,1000],
      [1000,2000],[2000,3000],[3000,Infinity]
    ]
    const colors = ['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#22209C','#3b82f6','#60a5fa','#93c5fd','#f59e0b','#f97316','#ef4444','#dc2626','#991b1b','#111']
    const data = tranches.map(([min,max], i) => {
      const ca = ventesCurrentMonth
        .filter(v => { const p = v.prixVenteReel || v.prix || 0; return p >= min && p < max })
        .reduce((s, v) => s + (v.prixVenteReel || v.prix || 0), 0)
      return { name: max === Infinity ? `${min}€+` : `${min}-${max}€`, ca, color: colors[i] }
    }).filter(d => d.ca > 0)
    const total = data.reduce((s, d) => s + d.ca, 0)
    return data.map(d => ({ ...d, pct: total > 0 ? Math.round(d.ca / total * 100) : 0 }))
  }, [ventesCurrentMonth])

  // Classement vendeuses par CA (réconciliation planning + ventes)
  const classementVendeuses = useMemo(() => {
    const map = new Map<string, { ca: number; ventes: number }>()

    ventesCurrentMonth.forEach(v => {
      const date = getDateVente(v)
      if (!date) return
      const dateStr = format(date, 'yyyy-MM-dd')
      const hour = date.getHours()

      // Trouver la vendeuse qui bossait ce jour
      const slot1220 = planningSlots[`${dateStr}_12-20`]
      const slot1117 = planningSlots[`${dateStr}_11-17`]

      let vendeuseId: string | null = null
      if (slot1220 && slot1117) {
        // 2 vendeuses ce jour : attribuer selon l'heure
        vendeuseId = hour < 12 ? slot1117 : hour >= 17 ? slot1220 : slot1220
      } else {
        vendeuseId = slot1220 || slot1117 || null
      }

      if (!vendeuseId) return
      const current = map.get(vendeuseId) || { ca: 0, ventes: 0 }
      map.set(vendeuseId, {
        ca: current.ca + (v.prixVenteReel || v.prix || 0),
        ventes: current.ventes + 1,
      })
    })

    return Array.from(map.entries())
      .map(([id, data]) => {
        const vend = vendeusesList.find(v => v.id === id)
        return { id, nom: vend?.prenom || id, couleur: vend?.couleur || '#999', ...data }
      })
      .sort((a, b) => b.ca - a.ca)
  }, [ventesCurrentMonth, planningSlots, vendeusesList])

  // Chineuses actives ce mois
  const chineusesActives = new Set(ventesCurrentMonth.map(v => v.chineur).filter(Boolean)).size

  const getMedal = (index: number) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `${index + 1}.`
  }

  const KpiCard = ({ title, value, unit, evolution, icon: Icon, color }: any) => (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500">{title}</span>
        <div className={`p-1.5 rounded-md ${color}`}>
          <Icon size={14} className="text-white" />
        </div>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-xl font-bold text-gray-900">{value}</span>
        <span className="text-gray-400 text-xs mb-0.5">{unit}</span>
      </div>
      {evolution !== null && evolution !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${parseFloat(evolution) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {parseFloat(evolution) >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          <span>{parseFloat(evolution) >= 0 ? '+' : ''}{evolution}%</span>
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Performance</h1>
          <p className="text-gray-400 text-xs">
            {ventes.length} ventes totales • {ventesCurrentMonth.length} ce mois
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="text-gray-400" />
          <select
            value={`${selectedYear}-${selectedMonth}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-')
              setSelectedYear(parseInt(y))
              setSelectedMonth(parseInt(m))
            }}
            className="border border-gray-200 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C]"
          >
            {availableMonths.map(({ year, month, label }) => (
              <option key={`${year}-${month}`} value={`${year}-${month}`}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Chiffre d'affaires" value={totalCA.toLocaleString('fr-FR')} unit="€" evolution={caEvolution} icon={Euro} color="bg-[#22209C]" />
        <KpiCard title="Ventes" value={totalVentes} unit="articles" evolution={ventesEvolution} icon={ShoppingBag} color="bg-emerald-500" />
        <KpiCard title="Panier moyen" value={panierMoyen} unit="€" evolution={panierEvolution} icon={TrendingUp} color="bg-amber-500" />
        <KpiCard title="Bénéfice NR" value={classementChineuses.reduce((s, c) => s + c.benef, 0).toLocaleString('fr-FR')} unit="€" evolution={totalCA > 0 ? String(Math.round(classementChineuses.reduce((s, c) => s + c.benef, 0) / totalCA * 100)) : null} icon={Award} color="bg-pink-500" />
      </div>

      {/* ============================== */}
      {/* SOURCING : Chineuses & Produit */}
      {/* ============================== */}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
      {/* Classement Chineuses */}
      <div className="lg:col-span-3">
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Award className="text-amber-500" size={16} />
          <h2 className="text-sm font-semibold text-gray-900">Classement Chineuses</h2>
          <span className="text-xs text-gray-400">{moisCourt[selectedMonth]} {selectedYear}</span>
        </div>
        {classementChineuses.length === 0 ? (
          <p className="text-gray-400 text-center py-4 text-xs">Aucune vente ce mois</p>
        ) : (
          <div><div className="hidden lg:grid grid-cols-2 gap-4">
            {[0, 1].map(col => (
              <table key={col} className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>#</th>
                    <th className="text-left py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Chineuse</th>
                    <th className="text-right py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>CA</th>
                    <th className="text-right py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Ventes</th>
                    <th className="text-right py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Bénéf.</th>
                  </tr>
                </thead>
                <tbody>
                  {classementChineuses
                    .slice(col * Math.ceil(classementChineuses.length / 2), (col + 1) * Math.ceil(classementChineuses.length / 2))
                    .map((c, i) => {
                      const realIndex = col * Math.ceil(classementChineuses.length / 2) + i
                      return (
                        <tr key={c.key} className={`border-b border-gray-50 ${realIndex < 3 ? 'bg-amber-50/30' : ''}`}>
                          <td className="py-1.5 px-1.5 text-sm">{getMedal(realIndex)}</td>
                          <td className="py-1.5 px-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#22209C] to-purple-500 flex items-center justify-center text-white font-bold" style={{ fontSize: '9px' }}>
                                {c.trigramme}
                              </div>
                              <span className="font-medium text-gray-900">{c.nom.toUpperCase()}</span>
                            </div>
                          </td>
                          <td className="py-1.5 px-1.5 text-right font-semibold text-gray-900"><span className="whitespace-nowrap">{c.ca.toLocaleString('fr-FR')}€</span></td>
                          <td className="py-1.5 px-1.5 text-right text-gray-600">{c.ventes}</td>
                          <td className="py-1.5 px-1.5 text-right font-semibold text-green-600">{c.benef.toLocaleString('fr-FR')} €</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            ))}
          </div>
          <div className="lg:hidden">
              <table className="w-full text-xs"><thead><tr className="border-b border-gray-100"><th className="text-left py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>#</th><th className="text-left py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Chineuse</th><th className="text-right py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>CA</th><th className="text-right py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Ventes</th><th className="text-right py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Bénéf.</th></tr></thead><tbody>{(showAllChineuses ? classementChineuses : classementChineuses.slice(0, 10)).map((c, i) => (<tr key={c.key} className={`border-b border-gray-50 ${i < 3 ? 'bg-amber-50/30' : ''}`}><td className="py-1.5 px-1.5 text-sm">{getMedal(i)}</td><td className="py-1.5 px-1.5"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#22209C] to-purple-500 flex items-center justify-center text-white font-bold" style={{ fontSize: '9px' }}>{c.trigramme}</div><span className="font-medium text-gray-900">{c.nom.toUpperCase()}</span></div></td><td className="py-1.5 px-1.5 text-right font-semibold text-gray-900 whitespace-nowrap">{c.ca.toLocaleString('fr-FR')}€</td><td className="py-1.5 px-1.5 text-right text-gray-600">{c.ventes}</td><td className="py-1.5 px-1.5 text-right font-semibold text-green-600">{c.benef.toLocaleString('fr-FR')} €</td></tr>))}</tbody></table>{classementChineuses.length > 10 && (<button onClick={() => setShowAllChineuses(!showAllChineuses)} className="w-full mt-2 py-2 text-xs text-[#22209C] font-medium border border-gray-200 rounded-lg hover:bg-gray-50">{showAllChineuses ? 'Réduire ▲' : `Voir tout (${classementChineuses.length}) ▼`}</button>)}
            </div>
          </div>
        )}
      </div>

      </div>
      {/* Top Catégories */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Catégories</h3>
          {topCategories.length === 0 ? (
            <p className="text-gray-400 text-center py-4 text-xs">Aucune donnée</p>
          ) : (
            <div className="space-y-2.5">
              {topCategories.map((item, i) => (
                <div key={item.cat} className="flex items-center gap-2">
                  <span className="text-sm w-5 shrink-0">{getMedal(i)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-700 font-medium truncate">{item.cat}</span>
                      <span className="text-gray-500 shrink-0 ml-2">{item.ca.toLocaleString('fr-FR')} €</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#22209C] rounded-full" style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        </div>{/* fin grid row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Fast Sellers */}
        <div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-1.5 mb-3">
            <Zap className="text-orange-500" size={14} />
            <h3 className="text-sm font-semibold text-gray-900">Fast Sellers</h3>
            <span className="text-xs text-gray-400">top 20</span>
          </div>
          {topFastSellers.length === 0 ? (
            <p className="text-gray-400 text-center py-4 text-xs">Aucune donnée</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto">
              {topFastSellers.map((item, i) => (
                <div key={item.id} className="border border-gray-100 rounded-lg overflow-hidden">
                  {item.photo ? (
                    <img src={item.photo} alt={item.nom} className="w-full h-24 object-cover" />
                  ) : (
                    <div className="w-full h-24 bg-gray-100 flex items-center justify-center text-gray-300 text-xs">No photo</div>
                  )}
                  <div className="p-1.5">
                    <p className="text-xs font-medium text-gray-900 truncate">{item.nom}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-gray-500" style={{ fontSize: '10px' }}>{item.prix.toLocaleString('fr-FR')} €</span>
                      <span className={`text-xs font-semibold px-1 py-0.5 rounded ${item.jours === 0 ? 'bg-green-100 text-green-700' : item.jours <= 3 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                        {item.jours === 0 ? '0j' : `${item.jours}j`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Répartition CA par tranche de prix */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Répartition CA par prix</h2>
        <div className="flex justify-center">
          <div className="w-[420px] h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={prixParTranche} dataKey="ca" nameKey="name" cx="50%" cy="50%" outerRadius={100} strokeWidth={1} label={({ name, pct, cx, cy, midAngle, outerRadius }) => { const RADIAN = Math.PI / 180; const radius = outerRadius + 20; const x = cx + radius * Math.cos(-midAngle * RADIAN); const y = cy + radius * Math.sin(-midAngle * RADIAN); return (<text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={13} fontWeight="600" fill="#111827">{name} {pct}%</text>); }} labelLine={{ stroke: '#9ca3af', strokeWidth: 0.5 }}>
                  {prixParTranche.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toLocaleString('fr-FR')} €`} contentStyle={{ fontSize: '11px', borderRadius: '6px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      </div>{/* fin grid row 2 */}

      {/* ============================== */}
      {/* ÉQUIPE VENTE                   */}
      {/* ============================== */}

      {/* Classement Vendeuses */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Users className="text-purple-500" size={16} />
          <h2 className="text-sm font-semibold text-gray-900">CA Vendeuses</h2>
          <span className="text-xs text-gray-400">{moisCourt[selectedMonth]} {selectedYear}</span>
        </div>
        {classementVendeuses.length === 0 ? (
          <p className="text-gray-400 text-center py-4 text-xs">Aucune donnée (planning non rempli ?)</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>#</th>
                  <th className="text-left py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Vendeuse</th>
                  <th className="text-right py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>CA</th>
                  <th className="text-right py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Ventes</th>
                  <th className="text-right py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Moy.</th>
                </tr>
              </thead>
              <tbody>
                {classementVendeuses.map((v, i) => (
                  <tr key={v.id} className={`border-b border-gray-50 ${i < 3 ? 'bg-purple-50/30' : ''}`}>
                    <td className="py-1.5 px-1.5 text-sm">{getMedal(i)}</td>
                    <td className="py-1.5 px-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: v.couleur }} />
                        <span className="font-medium text-gray-900">{v.nom}</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-semibold text-gray-900">{v.ca.toLocaleString('fr-FR')} €</td>
                    <td className="py-1.5 px-1.5 text-right text-gray-600">{v.ventes}</td>
                    <td className="py-1.5 px-1.5 text-right text-gray-600">{v.ventes > 0 ? Math.round(v.ca / v.ventes) : 0} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Meilleurs Jours + Heures de vente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Meilleurs Jours de la semaine */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-1.5 mb-3">
            <Star className="text-yellow-500" size={14} />
            <h3 className="text-sm font-semibold text-gray-900">Meilleurs Jours</h3>
          </div>
          {bestWeekdays.length === 0 ? (
            <p className="text-gray-400 text-center py-4 text-xs">Aucune donnée</p>
          ) : (
            <div className="space-y-2">
              {bestWeekdays.map((day, i) => {
                const maxMoy = bestWeekdays[0]?.moyenne || 1
                return (
                  <div key={day.dow} className="flex items-center gap-2">
                    <span className="text-sm w-5 shrink-0">{getMedal(i)}</span>
                    <span className="text-xs font-medium text-gray-700 w-16 shrink-0">{day.label}</span>
                    <div className="flex-1 h-4 bg-gray-50 rounded overflow-hidden">
                      <div className="h-full bg-amber-400 rounded" style={{ width: `${Math.round((day.moyenne / maxMoy) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-900 w-14 text-right">{day.moyenne.toLocaleString('fr-FR')} €</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Heures de vente */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-1.5 mb-3">
            <Calendar className="text-blue-500" size={14} />
            <h3 className="text-sm font-semibold text-gray-900">Heures de vente</h3>
          </div>
          {bestHours.length === 0 ? (
            <p className="text-gray-400 text-center py-4 text-xs">Aucune donnée</p>
          ) : (
            <div className="space-y-1.5">
              {bestHours.map((item) => {
                const maxCount = bestHours[0]?.count || 1
                return (
                  <div key={item.hour} className="flex items-center gap-2 py-0.5">
                    <span className="text-xs text-gray-500 w-14 shrink-0 whitespace-nowrap">{item.hour}h-{item.hour + 1}h</span>
                    <div className="flex-1 h-4 bg-gray-50 rounded overflow-hidden">
                      <div className="h-full bg-[#22209C]/80 rounded" style={{ width: `${Math.round((item.count / maxCount) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-8 text-right">{item.count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Graphique CA par jour */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">CA journalier</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={(v) => `${v}€`} width={45} />
              <Tooltip
                formatter={(value: number) => [`${value} €`, '']}
                contentStyle={{ borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="ca" name={moisCourt[selectedMonth]} stroke="#22209C" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="caPrecedent" name={moisCourt[selectedMonth - 1 < 0 ? 11 : selectedMonth - 1]} stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
              {monthEvents.map((evt, i) => (
                <ReferenceArea key={i} x1={`${evt.dayStart}/${selectedMonth + 1}`} x2={`${evt.dayEnd}/${selectedMonth + 1}`} fill={evt.color} label={{ value: evt.label, position: 'top', fontSize: 8 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
  }