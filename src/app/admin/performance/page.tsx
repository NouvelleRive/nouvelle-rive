// app/admin/performance/page.tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { db } from '@/lib/firebaseConfig'
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore'
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Users, ShoppingBag, Euro, Award, Calendar, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Vente = {
  id: string
  dateVente: Timestamp
  prixVenteReel?: number
  prix?: number
  chineur?: string
  categorie?: any
  sku?: string
  nom?: string
}

type Deposant = {
  id: string
  email: string
  nom?: string
  trigramme?: string
}

const moisLabels = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

export default function PerformancePage() {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [ventes, setVentes] = useState<Vente[]>([])
  const [deposants, setDeposants] = useState<Deposant[]>([])
  const [loading, setLoading] = useState(true)

  // Charger les déposants
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'deposants'), (snap) => {
      setDeposants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Deposant)))
    })
    return () => unsub()
  }, [])

  // Charger les ventes (produits vendus)
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'produits'), where('vendu', '==', true)),
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Vente))
        setVentes(data)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  // Filtrer par mois
  const currentMonthStart = startOfMonth(new Date(selectedYear, selectedMonth))
  const currentMonthEnd = endOfMonth(new Date(selectedYear, selectedMonth))
  const previousMonthStart = startOfMonth(subMonths(currentMonthStart, 1))
  const previousMonthEnd = endOfMonth(subMonths(currentMonthStart, 1))

  const ventesCurrentMonth = useMemo(() => {
    return ventes.filter(v => {
      if (!v.dateVente) return false
      const date = v.dateVente.toDate()
      return date >= currentMonthStart && date <= currentMonthEnd
    })
  }, [ventes, currentMonthStart, currentMonthEnd])

  const ventesPreviousMonth = useMemo(() => {
    return ventes.filter(v => {
      if (!v.dateVente) return false
      const date = v.dateVente.toDate()
      return date >= previousMonthStart && date <= previousMonthEnd
    })
  }, [ventes, previousMonthStart, previousMonthEnd])

  // KPIs
  const totalCA = ventesCurrentMonth.reduce((sum, v) => sum + (v.prixVenteReel || v.prix || 0), 0)
  const totalVentes = ventesCurrentMonth.length
  const previousCA = ventesPreviousMonth.reduce((sum, v) => sum + (v.prixVenteReel || v.prix || 0), 0)
  const previousVentes = ventesPreviousMonth.length

  const caEvolution = previousCA > 0 ? ((totalCA - previousCA) / previousCA * 100).toFixed(1) : '0'
  const ventesEvolution = previousVentes > 0 ? ((totalVentes - previousVentes) / previousVentes * 100).toFixed(1) : '0'
  const panierMoyen = totalVentes > 0 ? (totalCA / totalVentes).toFixed(0) : '0'
  const previousPanierMoyen = previousVentes > 0 ? (previousCA / previousVentes).toFixed(0) : '0'
  const panierEvolution = parseFloat(previousPanierMoyen) > 0 
    ? ((parseFloat(panierMoyen) - parseFloat(previousPanierMoyen)) / parseFloat(previousPanierMoyen) * 100).toFixed(1) 
    : '0'

  // CA par jour
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: currentMonthStart, end: currentMonthEnd })
    const previousDays = eachDayOfInterval({ start: previousMonthStart, end: previousMonthEnd })

    return days.map((day, index) => {
      const dayStr = format(day, 'yyyy-MM-dd')
      const caJour = ventesCurrentMonth
        .filter(v => format(v.dateVente.toDate(), 'yyyy-MM-dd') === dayStr)
        .reduce((sum, v) => sum + (v.prixVenteReel || v.prix || 0), 0)

      const prevDay = previousDays[index]
      const prevDayStr = prevDay ? format(prevDay, 'yyyy-MM-dd') : ''
      const caPrecedent = prevDay ? ventesPreviousMonth
        .filter(v => format(v.dateVente.toDate(), 'yyyy-MM-dd') === prevDayStr)
        .reduce((sum, v) => sum + (v.prixVenteReel || v.prix || 0), 0) : 0

      return {
        jour: index + 1,
        date: format(day, 'd/M'),
        ca: caJour,
        caPrecedent,
      }
    })
  }, [ventesCurrentMonth, ventesPreviousMonth, currentMonthStart, currentMonthEnd, previousMonthStart, previousMonthEnd])

  // Classement chineuses
  const classementChineuses = useMemo(() => {
    const map = new Map<string, { ca: number; ventes: number }>()
    
    ventesCurrentMonth.forEach(v => {
      const email = v.chineur || 'unknown'
      const current = map.get(email) || { ca: 0, ventes: 0 }
      map.set(email, {
        ca: current.ca + (v.prixVenteReel || v.prix || 0),
        ventes: current.ventes + 1,
      })
    })

    return Array.from(map.entries())
      .map(([email, data]) => {
        const dep = deposants.find(d => d.email === email)
        return {
          email,
          nom: dep?.nom || email.split('@')[0],
          trigramme: dep?.trigramme || email.substring(0, 3).toUpperCase(),
          ...data,
        }
      })
      .sort((a, b) => b.ca - a.ca)
  }, [ventesCurrentMonth, deposants])

  // Top catégories
  const topCategories = useMemo(() => {
    const map = new Map<string, number>()
    
    ventesCurrentMonth.forEach(v => {
      const cat = typeof v.categorie === 'object' ? v.categorie?.label : v.categorie || 'Autre'
      map.set(cat, (map.get(cat) || 0) + (v.prixVenteReel || v.prix || 0))
    })

    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const maxCA = sorted[0]?.[1] || 1

    return sorted.map(([cat, ca]) => ({
      cat,
      ca,
      pct: Math.round((ca / maxCA) * 100),
    }))
  }, [ventesCurrentMonth])

  // Chineuses actives ce mois
  const chineusesActives = new Set(ventesCurrentMonth.map(v => v.chineur)).size

  const getMedal = (index: number) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `${index + 1}.`
  }

  const KpiCard = ({ title, value, unit, evolution, icon: Icon, color }: any) => (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{title}</span>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        <span className="text-gray-400 text-sm mb-1">{unit}</span>
      </div>
      {evolution !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-sm ${parseFloat(evolution) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {parseFloat(evolution) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{parseFloat(evolution) >= 0 ? '+' : ''}{evolution}% vs mois précédent</span>
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
              <ArrowLeft size={20} className="text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Performance</h1>
              <p className="text-gray-500 text-sm mt-1">Vue d'ensemble des ventes</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-gray-400" />
            <select
              value={`${selectedYear}-${selectedMonth}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-')
                setSelectedYear(parseInt(y))
                setSelectedMonth(parseInt(m))
              }}
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C]"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) => (
                <option key={m} value={`${selectedYear}-${m}`}>{moisLabels[m]} {selectedYear}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            title="Chiffre d'affaires"
            value={totalCA.toLocaleString('fr-FR')}
            unit="€"
            evolution={caEvolution}
            icon={Euro}
            color="bg-[#22209C]"
          />
          <KpiCard
            title="Ventes"
            value={totalVentes}
            unit="articles"
            evolution={ventesEvolution}
            icon={ShoppingBag}
            color="bg-emerald-500"
          />
          <KpiCard
            title="Panier moyen"
            value={panierMoyen}
            unit="€"
            evolution={panierEvolution}
            icon={TrendingUp}
            color="bg-amber-500"
          />
          <KpiCard
            title="Chineuses actives"
            value={chineusesActives}
            unit="ce mois"
            icon={Users}
            color="bg-pink-500"
          />
        </div>

        {/* Graphique CA par jour */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">CA journalier</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `${v}€`} />
                <Tooltip
                  formatter={(value: number) => [`${value} €`, '']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="ca"
                  name={moisLabels[selectedMonth]}
                  stroke="#22209C"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="caPrecedent"
                  name={moisLabels[selectedMonth - 1 < 0 ? 11 : selectedMonth - 1]}
                  stroke="#d1d5db"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Classement Chineuses */}
          <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Award className="text-amber-500" size={22} />
              <h2 className="text-lg font-semibold text-gray-900">Classement Chineuses</h2>
            </div>

            {classementChineuses.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Aucune vente ce mois</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-2 text-xs font-medium text-gray-400 uppercase">Rang</th>
                      <th className="text-left py-3 px-2 text-xs font-medium text-gray-400 uppercase">Chineuse</th>
                      <th className="text-right py-3 px-2 text-xs font-medium text-gray-400 uppercase">CA</th>
                      <th className="text-right py-3 px-2 text-xs font-medium text-gray-400 uppercase">Ventes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classementChineuses.map((c, i) => (
                      <tr key={c.email} className={`border-b border-gray-50 ${i < 3 ? 'bg-amber-50/30' : ''} hover:bg-gray-50 transition-colors`}>
                        <td className="py-3 px-2">
                          <span className="text-lg">{getMedal(i)}</span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#22209C] to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                              {c.trigramme}
                            </div>
                            <span className="font-medium text-gray-900">{c.nom}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="font-semibold text-gray-900">{c.ca.toLocaleString('fr-FR')} €</span>
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">{c.ventes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top Catégories */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Catégories</h3>
            {topCategories.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Aucune donnée</p>
            ) : (
              <div className="space-y-4">
                {topCategories.map((item) => (
                  <div key={item.cat}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{item.cat}</span>
                      <span className="text-gray-500">{item.ca.toLocaleString('fr-FR')} €</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#22209C] rounded-full transition-all" style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}