// components/PerformanceContent.tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { db } from '@/lib/firebaseConfig'
import { collection, onSnapshot, Timestamp, doc, getDoc, setDoc } from 'firebase/firestore'
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceArea, PieChart, Pie, Cell, Label } from 'recharts'
import { TrendingUp, TrendingDown, Users, ShoppingBag, Euro, Award, Calendar, Zap, Star, Package, MessageCircle } from 'lucide-react'
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
  marque?: string
  material?: string
  color?: string
  motif?: string
  modele?: string
  dateRetour?: Timestamp | string
  statutRecuperation?: string
  imageUrls?: string[]
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

type VenteDoc = {
  id: string
  produitId?: string
  nom?: string
  sku?: string
  trigramme?: string
  chineur?: string
  chineurUid?: string
  prixVenteReel?: number
  prixInitial?: number
  dateVente?: Timestamp
  createdAt?: Timestamp
  source?: string
}

type VendeusePerf = {
  id: string
  prenom: string
  couleur: string
}

type PerformanceContentProps = {
  role: 'admin' | 'chineuse'
  chineuseTrigramme?: string
}

const moisLabels = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const moisCourt = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

export default function PerformanceContent({ role, chineuseTrigramme }: PerformanceContentProps) {
  const isAdmin = role === 'admin'
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [showAllChineuses, setShowAllChineuses] = useState(false)
  const [produits, setProduits] = useState<Produit[]>([])
  const [deposants, setDeposants] = useState<Deposant[]>([])
  const [loading, setLoading] = useState(true)
  const [vendeusesList, setVendeusesList] = useState<VendeusePerf[]>([])
  const [planningSlots, setPlanningSlots] = useState<Record<string, string>>({})
  const [ventesData, setVentesData] = useState<VenteDoc[]>([])
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteLoaded, setNoteLoaded] = useState(false)
  const [selectedNoteTrigramme, setSelectedNoteTrigramme] = useState('')
  const [noteUpdatedBy, setNoteUpdatedBy] = useState('')
  const [noteUpdatedAt, setNoteUpdatedAt] = useState<Date | null>(null)

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

  // Charger les vendeuses (admin only)
  useEffect(() => {
    if (!isAdmin) return
    const unsub = onSnapshot(collection(db, 'vendeuses'), (snap) => {
      setVendeusesList(snap.docs.map(d => ({ id: d.id, ...d.data() } as VendeusePerf)))
    })
    return () => unsub()
  }, [isAdmin])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'ventes'), (snap) => {
      setVentesData(snap.docs.map(d => ({ id: d.id, ...d.data() } as VenteDoc)))
    })
    return () => unsub()
  }, [])

  // Charger le planning du mois sélectionné (admin only)
  useEffect(() => {
    if (!isAdmin) return
    const fetchPlanning = async () => {
      const mKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`
      const snap = await getDoc(doc(db, 'planning', mKey))
      setPlanningSlots(snap.exists() ? (snap.data().slots || {}) : {})
    }
    fetchPlanning()
  }, [selectedMonth, selectedYear, isAdmin])

  // Charger la note chineuse
  const noteTrigramme = isAdmin ? selectedNoteTrigramme : (chineuseTrigramme || '')
  useEffect(() => {
    if (!noteTrigramme) {
      setNoteText('')
      setNoteLoaded(false)
      return
    }
    const fetchNote = async () => {
      const snap = await getDoc(doc(db, 'notes-chineuses', noteTrigramme))
      if (snap.exists()) {
        const data = snap.data()
        setNoteText(data.message || '')
        setNoteUpdatedBy(data.updatedBy || '')
        setNoteUpdatedAt(data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null)
      } else {
        setNoteText('')
        setNoteUpdatedBy('')
        setNoteUpdatedAt(null)
      }
      setNoteLoaded(true)
    }
    fetchNote()
  }, [noteTrigramme])

  const saveNote = async () => {
    if (!noteTrigramme) return
    setNoteSaving(true)
    try {
      await setDoc(doc(db, 'notes-chineuses', noteTrigramme), {
        message: noteText,
        updatedBy: isAdmin ? 'admin' : 'vendeuse',
        updatedAt: new Date(),
      })
    } catch (err) {
      console.error('Erreur sauvegarde note:', err)
    }
    setNoteSaving(false)
  }

  // Générer tous les mois disponibles depuis les données
  const availableMonths = useMemo(() => {
    const months: { year: number; month: number; label: string }[] = []
    const startYear = 2024
    for (let y = startYear; y <= now.getFullYear(); y++) {
      const maxMonth = y === now.getFullYear() ? now.getMonth() : 11
      for (let m = 0; m <= maxMonth; m++) {
        months.push({ year: y, month: m, label: `${moisCourt[m]} ${y}` })
      }
    }
    return months.reverse()
  }, [])

  const produitsMap = useMemo(() => {
    const map = new Map<string, Produit>()
    produits.forEach(p => map.set(p.id, p))
    return map
  }, [produits])

  // Filtrer les ventes (produits vendus)
  const ventes = ventesData

  // Filtrer par mois
  const currentMonthStart = startOfMonth(new Date(selectedYear, selectedMonth))
  const currentMonthEnd = endOfMonth(new Date(selectedYear, selectedMonth))
  const previousMonthStart = startOfMonth(subMonths(currentMonthStart, 1))
  const previousMonthEnd = endOfMonth(subMonths(currentMonthStart, 1))

  // Helper pour obtenir la date de vente
  const getDateVente = (v: any): Date | null => {
    if (v.dateVente instanceof Timestamp) return v.dateVente.toDate()
    if (v.createdAt instanceof Timestamp) return v.createdAt.toDate()
    return null
  }

  // Helper pour obtenir la date d'entrée
  const getDateEntree = (p: Produit): Date | null => {
    if (p.dateEntree instanceof Timestamp) return p.dateEntree.toDate()
    if (p.createdAt instanceof Timestamp) return p.createdAt.toDate()
    return null
  }

  // Ventes filtrées par trigramme si chineuse
  const ventesCurrentMonth = useMemo(() => {
    return ventes.filter(v => {
      const date = getDateVente(v)
      if (!date) return false
      if (date < currentMonthStart || date > currentMonthEnd) return false
      if (!isAdmin && chineuseTrigramme) {
        return (v as any).trigramme === chineuseTrigramme
      }
      return true
    })
  }, [ventes, currentMonthStart, currentMonthEnd, isAdmin, chineuseTrigramme])

  const ventesPreviousMonth = useMemo(() => {
    return ventes.filter(v => {
      const date = getDateVente(v)
      if (!date) return false
      if (date < previousMonthStart || date > previousMonthEnd) return false
      if (!isAdmin && chineuseTrigramme) {
        return (v as any).trigramme === chineuseTrigramme
      }
      return true
    })
  }, [ventes, previousMonthStart, previousMonthEnd, isAdmin, chineuseTrigramme])

  // KPIs
  const totalCA = ventesCurrentMonth.reduce((sum, v) => sum + (v.prixVenteReel || v.prix || 0), 0)
  const totalVentes = ventesCurrentMonth.length
  const previousCA = ventesPreviousMonth.reduce((sum, v) => sum + (v.prixVenteReel || v.prix || 0), 0)
  const previousVentes = ventesPreviousMonth.length
  // Pro-rata : nb jours écoulés du mois sélectionné vs nb jours total du mois précédent
  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear()
  const joursEcoules = isCurrentMonth
    ? now.getDate()
    : differenceInDays(currentMonthEnd, currentMonthStart) + 1
  const joursMoisPrecedent = differenceInDays(previousMonthEnd, previousMonthStart) + 1
  const prorata = joursEcoules / joursMoisPrecedent
  const previousCAProrata = Math.round(previousCA * prorata)
  const previousVentesProrata = Math.round(previousVentes * prorata)
  const previousPanierMoyenProrata = previousVentesProrata > 0 ? Math.round(previousCAProrata / previousVentesProrata) : 0

  const caEvolution = previousCAProrata > 0 ? ((totalCA - previousCAProrata) / previousCAProrata * 100).toFixed(1) : null
  const ventesEvolution = previousVentesProrata > 0 ? ((totalVentes - previousVentesProrata) / previousVentesProrata * 100).toFixed(1) : null
  const panierMoyen = totalVentes > 0 ? Math.round(totalCA / totalVentes) : 0
  const panierEvolution = previousPanierMoyenProrata > 0
    ? ((panierMoyen - previousPanierMoyenProrata) / previousPanierMoyenProrata * 100).toFixed(1)
    : null

  // CA par jour (admin only)
  const dailyData = useMemo(() => {
    if (!isAdmin) return []
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
  }, [ventesCurrentMonth, ventesPreviousMonth, currentMonthStart, currentMonthEnd, previousMonthStart, previousMonthEnd, isAdmin])

  // Résoudre le nom d'une chineuse (grouper par ID déposant, pas par email)
  const resolveChineuse = (email: string) => {
    const dep = deposants.find(d => d.email === email)
    return dep?.id || email
  }

  const getChineuseDisplayName = (chineuseKey: string) => {
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
      const produit = v.produitId ? produitsMap.get(v.produitId) : null
      const rawCat = produit?.categorie
      const cat = typeof rawCat === 'object' ? rawCat?.label : rawCat || 'Autre'
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
        const produit = v.produitId ? produitsMap.get(v.produitId) : null
        const dateEntree = produit ? getDateEntree(produit) : null
        if (!dateVente || !dateEntree) return null
        const jours = differenceInDays(dateVente, dateEntree)
        if (jours < 0) return null
        const photos = produit?.photos || {} as any
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

  // Invendus - pièces récupérées par la chineuse ce mois
  const topInvendus = useMemo(() => {
    return produits
      .filter(p => {
        if (p.statut !== 'retour') return false
        // Filtrer par trigramme si chineuse
        if (!isAdmin && chineuseTrigramme) {
          const pTri = (p as any).trigramme || p.sku?.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || ''
          if (pTri !== chineuseTrigramme) return false
        }
        const dateRetour = p.dateRetour instanceof Timestamp
          ? p.dateRetour.toDate()
          : p.dateRetour ? new Date(p.dateRetour as any) : null
        if (!dateRetour) return false
        return dateRetour >= currentMonthStart && dateRetour <= currentMonthEnd
      })
      .map(p => {
        const dateEntree = getDateEntree(p)
        const dateRetour = p.dateRetour instanceof Timestamp
          ? p.dateRetour.toDate()
          : new Date(p.dateRetour as any)
        const jours = dateEntree ? differenceInDays(dateRetour, dateEntree) : null
        const photos = (p as any).photos || {}
        const imgUrls = p.imageUrls || []
        const photo = photos.face || imgUrls[0] || (p as any).imageUrl || null
        return {
          id: p.id,
          nom: p.nom || p.sku || 'Sans nom',
          prix: p.prix || 0,
          jours,
          photo: photo as string | null,
          trigramme: (p as any).trigramme || p.sku?.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || '',
        }
      })
      .sort((a, b) => (b.jours ?? 0) - (a.jours ?? 0))
      .slice(0, 20)
  }, [produits, currentMonthStart, currentMonthEnd, isAdmin, chineuseTrigramme])

  // Moyenne CA par jour de la semaine (filtré par mois sélectionné)
  const bestWeekdays = useMemo(() => {
    if (!isAdmin) return []
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
  }, [ventesCurrentMonth, currentMonthStart, currentMonthEnd, isAdmin])

  // Meilleures heures de vente
  const bestHours = useMemo(() => {
    if (!isAdmin) return []
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
  }, [ventesCurrentMonth, isAdmin])

  const monthEvents = useMemo(() => getMonthEvents(selectedMonth, selectedYear), [selectedMonth, selectedYear])

  const prixParTranche = useMemo(() => {
    const tranches = [
      [0,50],[50,100],[100,200],[200,300],[300,400],[400,500],
      [500,600],[600,700],[700,800],[800,900],[900,1000],
      [1000,2000],[2000,3000],[3000,Infinity]
    ]
    const colors = ['#e0e7ff','#c7d2fe','#a5b4fc','#818cf8','#6366f1','#4f46e5','#4338ca','#3730a3','#312e81','#22209C','#1e1b4b','#171533','#100e24','#0a0914']
    const data = tranches.map(([min,max], i) => {
      const ca = ventesCurrentMonth
        .filter(v => { const p = v.prixVenteReel || v.prix || 0; return p >= min && p < max })
        .reduce((s, v) => s + (v.prixVenteReel || v.prix || 0), 0)
      return { name: max === Infinity ? `${min}€+` : `${min}-${max}€`, ca, color: colors[i] }
    }).filter(d => d.ca > 0)
    const total = data.reduce((s, d) => s + d.ca, 0)
    return data.map(d => ({ ...d, pct: total > 0 ? Math.round(d.ca / total * 100) : 0 }))
  }, [ventesCurrentMonth])

  const benefParTranche = useMemo(() => {
    if (!isAdmin) return []
    const tranches = [
      [0,50],[50,100],[100,200],[200,300],[300,400],[400,500],
      [500,600],[600,700],[700,800],[800,900],[900,1000],
      [1000,2000],[2000,3000],[3000,Infinity]
    ]
    const colors = ['#d1fae5','#a7f3d0','#6ee7b7','#34d399','#10b981','#059669','#047857','#065f46','#064e3b','#022c22','#1a1a2e','#111827','#0f0f1a','#0a0a12']
    const data = tranches.map(([min,max], i) => {
      const items = ventesCurrentMonth.filter(v => { const p = v.prixVenteReel || v.prix || 0; return p >= min && p < max })
      const benef = items.reduce((s, v) => {
        const prix = v.prixVenteReel || v.prix || 0
        const tri = (v as any).trigramme || ''
        const isNR = tri === 'NR'
        if (isNR) return s + prix
        const dep = deposants.find(d => d.trigramme === tri)
        const taux = dep?.['Catégorie de rapport']?.[0]?.taux ?? dep?.taux ?? 0
        return s + Math.round(prix * taux / 100)
      }, 0)
      return { name: max === Infinity ? `${min}€+` : `${min}-${max}€`, ca: benef, color: colors[i] }
    }).filter(d => d.ca > 0)
    const total = data.reduce((s, d) => s + d.ca, 0)
    return data.map(d => ({ ...d, pct: total > 0 ? Math.round(d.ca / total * 100) : 0 }))
  }, [ventesCurrentMonth, deposants, isAdmin])

  const topMarques = useMemo(() => {
    const map = new Map<string, { ca: number; count: number }>()
    ventesCurrentMonth.forEach(v => {
      const produit = v.produitId ? produitsMap.get(v.produitId) : null
      const m = produit?.marque || ''
      if (!m || m.length < 2) return
      const ml = m.toLowerCase()
      if (ml.startsWith('made in') || ml.startsWith('vintage') || ml === 'bombardier' || ml === 'morgan' || ml === 'âge paris' || ml === 'age paris') return
      const isChineuse = deposants.some(d => d.nom?.toLowerCase() === ml || d.email?.split('@')[0]?.toLowerCase() === ml)
      if (isChineuse) return
      const cur = map.get(m) || { ca: 0, count: 0 }
      map.set(m, { ca: cur.ca + (v.prixVenteReel || v.prix || 0), count: cur.count + 1 })
    })
    const sorted = Array.from(map.entries()).sort((a, b) => b[1].ca - a[1].ca).slice(0, 12)
    const maxCA = sorted[0]?.[1].ca || 1
    return sorted.map(([name, data]) => ({ name, ...data, pct: Math.round((data.ca / maxCA) * 100) }))
  }, [ventesCurrentMonth, deposants])

  const topCouleurs = useMemo(() => {
    const map = new Map<string, { ca: number; count: number }>()
    ventesCurrentMonth.forEach(v => {
      const produit = v.produitId ? produitsMap.get(v.produitId) : null
      const c = produit?.color || ''
      if (!c) return
      const cur = map.get(c) || { ca: 0, count: 0 }
      map.set(c, { ca: cur.ca + (v.prixVenteReel || v.prix || 0), count: cur.count + 1 })
    })
    const sorted = Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 10)
    const maxCount = sorted[0]?.[1].count || 1
    return sorted.map(([name, data]) => ({ name, ...data, pct: Math.round((data.count / maxCount) * 100) }))
  }, [ventesCurrentMonth])

  const topMatieres = useMemo(() => {
    const map = new Map<string, { ca: number; count: number }>()
    ventesCurrentMonth.forEach(v => {
      const produit = v.produitId ? produitsMap.get(v.produitId) : null
      const m = produit?.material || ''
      if (!m) return
      const cur = map.get(m) || { ca: 0, count: 0 }
      map.set(m, { ca: cur.ca + (v.prixVenteReel || v.prix || 0), count: cur.count + 1 })
    })
    const sorted = Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 10)
    const maxCount = sorted[0]?.[1].count || 1
    return sorted.map(([name, data]) => ({ name, ...data, pct: Math.round((data.count / maxCount) * 100) }))
  }, [ventesCurrentMonth])

  const topMotifs = useMemo(() => {
    const map = new Map<string, { ca: number; count: number }>()
    ventesCurrentMonth.forEach(v => {
      const produit = v.produitId ? produitsMap.get(v.produitId) : null
      const m = produit?.motif || ''
      if (!m) return
      const cur = map.get(m) || { ca: 0, count: 0 }
      map.set(m, { ca: cur.ca + (v.prixVenteReel || v.prix || 0), count: cur.count + 1 })
    })
    const sorted = Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 10)
    const maxCount = sorted[0]?.[1].count || 1
    return sorted.map(([name, data]) => ({ name, ...data, pct: Math.round((data.count / maxCount) * 100) }))
  }, [ventesCurrentMonth])

  const topModeles = useMemo(() => {
    const map = new Map<string, { ca: number; count: number }>()
    ventesCurrentMonth.forEach(v => {
      const produit = v.produitId ? produitsMap.get(v.produitId) : null
      const m = produit?.modele || ''
      if (!m) return
      const cur = map.get(m) || { ca: 0, count: 0 }
      map.set(m, { ca: cur.ca + (v.prixVenteReel || v.prix || 0), count: cur.count + 1 })
    })
    const sorted = Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 10)
    const maxCount = sorted[0]?.[1].count || 1
    return sorted.map(([name, data]) => ({ name, ...data, pct: Math.round((data.count / maxCount) * 100) }))
  }, [ventesCurrentMonth])

  // Classement vendeuses par CA (admin only)
  const classementVendeuses = useMemo(() => {
    if (!isAdmin) return []
    const map = new Map<string, { ca: number; ventes: number }>()

    ventesCurrentMonth.forEach(v => {
      const date = getDateVente(v)
      if (!date) return
      const dateStr = format(date, 'yyyy-MM-dd')
      const hour = date.getHours()

      const slot1220 = planningSlots[`${dateStr}_12-20`]
      const slot1117 = planningSlots[`${dateStr}_11-17`]

      let vendeuseId: string | null = null
      if (slot1220 && slot1117) {
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
  }, [ventesCurrentMonth, planningSlots, vendeusesList, isAdmin])

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
          <h1 className="text-lg font-bold text-gray-900">{isAdmin ? 'Performance' : 'Mes Performances'}</h1>
          <p className="text-gray-400 text-xs">
            {isAdmin ? `${ventes.length} ventes totales • ` : ''}{ventesCurrentMonth.length} vente{ventesCurrentMonth.length > 1 ? 's' : ''} ce mois
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
      <div className={`grid ${isAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'} gap-3`}>
        <KpiCard title="Chiffre d'affaires" value={totalCA.toLocaleString('fr-FR')} unit="€" evolution={caEvolution} icon={Euro} color="bg-[#22209C]" />
        <KpiCard title="Ventes" value={totalVentes} unit="articles" evolution={ventesEvolution} icon={ShoppingBag} color="bg-emerald-500" />
        <KpiCard title="Panier moyen" value={panierMoyen} unit="€" evolution={panierEvolution} icon={TrendingUp} color="bg-amber-500" />
        {isAdmin && (
          <KpiCard title="Marge" value={classementChineuses.reduce((s, c) => s + c.benef, 0).toLocaleString('fr-FR')} unit="€" evolution={totalCA > 0 ? String(Math.round(classementChineuses.reduce((s, c) => s + c.benef, 0) / totalCA * 100)) : null} icon={Award} color="bg-pink-500" />
        )}
      </div>

      {/* Note de l'équipe */}
      {isAdmin ? (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="text-[#22209C]" size={16} />
            <h2 className="text-sm font-semibold text-gray-900">Note pour les chineuses</h2>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <select
              value={selectedNoteTrigramme}
              onChange={(e) => { setSelectedNoteTrigramme(e.target.value); setNoteLoaded(false) }}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#22209C]/20"
            >
              <option value="">Sélectionner une chineuse…</option>
              {deposants.filter(d => d.trigramme).map(d => (
                <option key={d.id} value={d.trigramme}>{d.trigramme} — {d.nom || d.email}</option>
              ))}
            </select>
          </div>
          {selectedNoteTrigramme && noteLoaded && (
            <div className="space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Écrire un mot pour cette chineuse…"
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 resize-none"
                rows={3}
              />
              <div className="flex items-center justify-between">
                {noteUpdatedAt && (
                  <span className="text-xs text-gray-400">
                    Modifié par {noteUpdatedBy} le {format(noteUpdatedAt, 'd MMM yyyy à HH:mm', { locale: fr })}
                  </span>
                )}
                <button
                  onClick={saveNote}
                  disabled={noteSaving}
                  className="ml-auto px-4 py-1.5 bg-[#22209C] text-white text-xs font-medium rounded-md hover:bg-[#22209C]/90 disabled:opacity-50"
                >
                  {noteSaving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : noteLoaded && noteText ? (
        <div className="bg-gradient-to-r from-[#22209C]/5 to-purple-50 rounded-lg p-4 border border-[#22209C]/10">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="text-[#22209C]" size={14} />
            <h3 className="text-sm font-semibold text-gray-900">Mot de l&apos;équipe</h3>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{noteText}</p>
          {noteUpdatedAt && (
            <p className="text-xs text-gray-400 mt-2">{format(noteUpdatedAt, 'd MMM yyyy', { locale: fr })}</p>
          )}
        </div>
      ) : null}

      {/* ============================== */}
      {/* SOURCING : Chineuses & Produit */}
      {/* ============================== */}

      {isAdmin ? (
        /* ADMIN: Classement Chineuses + Top Catégories côte à côte */
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
                        <th className="text-right py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Marge</th>
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
                  <table className="w-full text-xs"><thead><tr className="border-b border-gray-100"><th className="text-left py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>#</th><th className="text-left py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Chineuse</th><th className="text-right py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>CA</th><th className="text-right py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Ventes</th><th className="text-right py-2 px-1.5 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Marge</th></tr></thead><tbody>{(showAllChineuses ? classementChineuses : classementChineuses.slice(0, 10)).map((c, i) => (<tr key={c.key} className={`border-b border-gray-50 ${i < 3 ? 'bg-amber-50/30' : ''}`}><td className="py-1.5 px-1.5 text-sm">{getMedal(i)}</td><td className="py-1.5 px-1.5"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#22209C] to-purple-500 flex items-center justify-center text-white font-bold" style={{ fontSize: '9px' }}>{c.trigramme}</div><span className="font-medium text-gray-900">{c.nom.toUpperCase()}</span></div></td><td className="py-1.5 px-1.5 text-right font-semibold text-gray-900 whitespace-nowrap">{c.ca.toLocaleString('fr-FR')}€</td><td className="py-1.5 px-1.5 text-right text-gray-600">{c.ventes}</td><td className="py-1.5 px-1.5 text-right font-semibold text-green-600">{c.benef.toLocaleString('fr-FR')} €</td></tr>))}</tbody></table>{classementChineuses.length > 10 && (<button onClick={() => setShowAllChineuses(!showAllChineuses)} className="w-full mt-2 py-2 text-xs text-[#22209C] font-medium border border-gray-200 rounded-lg hover:bg-gray-50">{showAllChineuses ? 'Réduire ▲' : `Voir tout (${classementChineuses.length}) ▼`}</button>)}
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
        </div>
      ) : (
        /* CHINEUSE: Top Catégories seul, pleine largeur */
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Mes Top Catégories</h3>
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
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Fast Sellers */}
        <div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-1.5 mb-3">
            <Zap className="text-orange-500" size={14} />
            <h3 className="text-sm font-semibold text-gray-900">{isAdmin ? 'Fast Sellers' : 'Mes Fast Sellers'}</h3>
            <span className="text-xs text-gray-400">top 20</span>
          </div>
          {topFastSellers.length === 0 ? (
            <p className="text-gray-400 text-center py-4 text-xs">Aucune donnée</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-[700px] overflow-y-auto">
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

      {/* Invendus */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 mt-3">
          <div className="flex items-center gap-1.5 mb-3">
            <Package className="text-red-400" size={14} />
            <h3 className="text-sm font-semibold text-gray-900">{isAdmin ? 'Invendus récupérés' : 'Mes invendus récupérés'}</h3>
            <span className="text-xs text-gray-400">{topInvendus.length} pièce{topInvendus.length > 1 ? 's' : ''}</span>
          </div>
          {topInvendus.length === 0 ? (
            <p className="text-gray-400 text-center py-4 text-xs">Aucun invendu ce mois</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-[700px] overflow-y-auto">
              {topInvendus.map((item) => (
                <div key={item.id} className="border border-gray-100 rounded-lg overflow-hidden">
                  {item.photo ? (
                    <img src={item.photo} alt={item.nom} className="w-full h-24 object-cover opacity-70" />
                  ) : (
                    <div className="w-full h-24 bg-gray-100 flex items-center justify-center text-gray-300 text-xs">No photo</div>
                  )}
                  <div className="p-1.5">
                    <p className="text-xs font-medium text-gray-900 truncate">{item.nom}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-gray-500" style={{ fontSize: '10px' }}>{item.prix.toLocaleString('fr-FR')} €</span>
                      <span className="text-xs font-semibold px-1 py-0.5 rounded bg-red-100 text-red-700">
                        {item.jours !== null ? `${item.jours}j` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div></div>

      {/* Répartition CA par tranche de prix */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Répartition par tranche de prix</h2>
        <div className={`grid grid-cols-1 ${isAdmin ? 'gap-6' : ''}`}>
          <div>
            <p className="text-xs text-gray-500 font-medium text-center mb-1">Chiffre d&apos;affaires</p>
            <div className="flex justify-center">
              <div className="w-[420px] h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={prixParTranche} dataKey="ca" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} strokeWidth={1} startAngle={90} endAngle={-270} label={({ name, pct, value, cx, cy, midAngle, outerRadius }) => { const RADIAN = Math.PI / 180; const radius = outerRadius + 28; const x = cx + radius * Math.cos(-midAngle * RADIAN); const y = cy + radius * Math.sin(-midAngle * RADIAN); const anchor = x > cx ? 'start' : 'end'; return (<g><text x={x} y={y - 7} textAnchor={anchor} fontSize={12} fontWeight="700" fill="#111827">{name}</text><text x={x} y={y + 7} textAnchor={anchor} fontSize={10} fill="#6b7280">{pct}% · {value.toLocaleString('fr-FR')}€</text></g>); }} labelLine={{ stroke: '#9ca3af', strokeWidth: 0.5 }}>
                      {prixParTranche.map((d, i) => <Cell key={i} fill={d.color} />)}
                      <Label value={`${totalCA.toLocaleString('fr-FR')}€`} position="center" fontSize={16} fontWeight="700" fill="#111827" />
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v.toLocaleString('fr-FR')} €`} contentStyle={{ fontSize: '11px', borderRadius: '6px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          {isAdmin && (
          <div>
            <p className="text-xs text-gray-500 font-medium text-center mb-1">Marge</p>
            <div className="flex justify-center">
              <div className="w-[420px] h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={benefParTranche} dataKey="ca" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} strokeWidth={1} startAngle={90} endAngle={-270} label={({ name, pct, value, cx, cy, midAngle, outerRadius }) => { const RADIAN = Math.PI / 180; const radius = outerRadius + 28; const x = cx + radius * Math.cos(-midAngle * RADIAN); const y = cy + radius * Math.sin(-midAngle * RADIAN); const anchor = x > cx ? 'start' : 'end'; if (pct < 4) return null; return (<g><text x={x} y={y - 7} textAnchor={anchor} fontSize={12} fontWeight="700" fill="#111827">{name}</text><text x={x} y={y + 7} textAnchor={anchor} fontSize={10} fill="#6b7280">{pct}% · {Math.round(value).toLocaleString('fr-FR')}€</text></g>); }} labelLine={{ stroke: '#9ca3af', strokeWidth: 0.5 }}>
                      {benefParTranche.map((d, i) => <Cell key={i} fill={d.color} />)}
                      <Label value={`${benefParTranche.reduce((s, d) => s + d.ca, 0).toLocaleString('fr-FR')}€`} position="center" fontSize={16} fontWeight="700" fill="#111827" />
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v.toLocaleString('fr-FR')} €`} contentStyle={{ fontSize: '11px', borderRadius: '6px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* ============================== */}
      {/* ANALYTICS PRODUIT              */}
      {/* ============================== */}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Marques</h3>
          {topMarques.length === 0 ? (
            <p className="text-gray-400 text-center py-4 text-xs">Aucune donnée</p>
          ) : (
            <div className="space-y-2">
              {topMarques.map((item, i) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <span className="text-xs w-4 shrink-0 text-gray-400">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-700 font-medium truncate">{item.name}</span>
                      <span className="text-gray-400 shrink-0 ml-1" style={{ fontSize: '10px' }}>{item.count}p · {item.ca.toLocaleString('fr-FR')}€</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#22209C] rounded-full" style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Couleurs</h3>
          {topCouleurs.length === 0 ? (
            <p className="text-gray-400 text-center py-4 text-xs">Aucune donnée</p>
          ) : (
            <div className="space-y-2">
              {topCouleurs.map((item, i) => {
                const colorMap: Record<string,string> = {'Noir':'#000','Blanc':'#fff','Écru':'#F5F5DC','Beige':'#D4B896','Camel':'#C19A6B','Marron':'#5C4033','Gris':'#808080','Anthracite':'#3D3D3D','Bleu marine':'#1E3A5F','Bleu ciel':'#87CEEB','Rouge':'#C41E3A','Bordeaux':'#6B1C23','Rose':'#E8B4B8','Vert':'#228B22','Kaki':'#6B6B47','Orange':'#E86100','Jaune':'#E8C547','Violet':'#6B3FA0','Doré':'#C5A048','Argenté':'#A8A8A8'}
                const bg = item.name === 'Multicolore' ? 'linear-gradient(135deg, #FF6B6B, #4ECDC4, #FFE66D, #A06CD5)' : undefined
                const bgColor = !bg ? (colorMap[item.name] || '#ccc') : undefined
                return (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full border border-gray-200 shrink-0" style={{ background: bg, backgroundColor: bgColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-700 font-medium truncate">{item.name}</span>
                        <span className="text-gray-400 shrink-0 ml-1" style={{ fontSize: '10px' }}>{item.count}p · {item.ca.toLocaleString('fr-FR')}€</span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-800 rounded-full" style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Matières</h3>
          {topMatieres.length === 0 ? (
            <p className="text-gray-400 text-center py-4 text-xs">Aucune donnée</p>
          ) : (
            <div className="space-y-2">
              {topMatieres.map((item, i) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <span className="text-xs w-4 shrink-0 text-gray-400">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-700 font-medium truncate">{item.name}</span>
                      <span className="text-gray-400 shrink-0 ml-1" style={{ fontSize: '10px' }}>{item.count}p · {item.ca.toLocaleString('fr-FR')}€</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Modèles</h3>
          {topModeles.length === 0 ? (
            <p className="text-gray-400 text-center py-4 text-xs">Aucune donnée</p>
          ) : (
            <div className="space-y-2">
              {topModeles.map((item, i) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <span className="text-xs w-4 shrink-0 text-gray-400">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-700 font-medium truncate">{item.name}</span>
                      <span className="text-gray-400 shrink-0 ml-1" style={{ fontSize: '10px' }}>{item.count}p · {item.ca.toLocaleString('fr-FR')}€</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Motifs</h3>
          {topMotifs.length === 0 ? (
            <p className="text-gray-400 text-center py-4 text-xs">Aucune donnée</p>
          ) : (
            <div className="space-y-2">
              {topMotifs.map((item, i) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <span className="text-xs w-4 shrink-0 text-gray-400">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-700 font-medium truncate">{item.name}</span>
                      <span className="text-gray-400 shrink-0 ml-1" style={{ fontSize: '10px' }}>{item.count}p · {item.ca.toLocaleString('fr-FR')}€</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-pink-500 rounded-full" style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ============================== */}
      {/* ÉQUIPE VENTE (admin only)      */}
      {/* ============================== */}

      {isAdmin && (
      <>
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
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="jour" tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={(v) => `${v}€`} width={45} />
              <Tooltip
                formatter={(value: number) => [`${value} €`, '']}
                contentStyle={{ borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="ca" name={moisCourt[selectedMonth]} stroke="#22209C" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="caPrecedent" name={moisCourt[selectedMonth - 1 < 0 ? 11 : selectedMonth - 1]} stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
              {monthEvents.map((evt, i) => (
                <ReferenceArea key={i} x1={evt.dayStart} x2={evt.dayEnd} fill={evt.color} label={{ value: evt.label, position: 'insideTop', fontSize: 10, fontWeight: 600, fill: '#374151' }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      </>
      )}
    </div>
  )
}