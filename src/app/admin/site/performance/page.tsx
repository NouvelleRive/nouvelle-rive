'use client'

// Backstage — audience du site public.
// Les données viennent de /api/backstage/stats (agrégats journaliers).

import { useEffect, useState, useCallback } from 'react'
import { auth } from '@/lib/firebaseConfig'
import { formatPrix, formatPrixEuro } from '@/lib/formatPrix'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

const BLEU = '#22209C'

type Stats = {
  days: number
  totals: {
    sessions: number
    pageviews: number
    addToCart: number
    checkoutStart: number
    conversions: number
    revenue: number
    searchCount: number
  }
  parJour: Array<{ day: string; sessions: number; pageviews: number; conversions: number; revenue: number }>
  devices: { mobile: number; desktop: number }
  pages: Array<{ page: string; vues: number; tempsMoyenMs: number }>
  pagesLongues: Array<{ page: string; vues: number; tempsMoyenMs: number }>
  sorties: Array<{ page: string; n: number }>
  entrees: Array<{ page: string; n: number }>
  recherches: Array<{ terme: string; n: number }>
  sources: Array<{ source: string; n: number }>
  villes: Array<{ ville: string; n: number }>
  pays: Array<{ pays: string; n: number }>
}

function duree(ms: number) {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  return `${m} min ${String(s % 60).padStart(2, '0')}`
}

function pourcent(n: number, total: number) {
  if (!total) return '0 %'
  return `${((n / total) * 100).toFixed(1).replace('.', ',')} %`
}

function jourCourt(day: string) {
  const [, m, d] = day.split('-')
  return `${d}/${m}`
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: BLEU }}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

function Classement({
  titre,
  sousTitre,
  lignes,
  vide,
}: {
  titre: string
  sousTitre?: string
  lignes: Array<{ label: string; valeur: string; detail?: string }>
  vide: string
}) {
  const max = Math.max(1, ...lignes.map((l) => Number(l.valeur.replace(/\D/g, '')) || 0))
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="font-semibold text-sm">{titre}</div>
      {sousTitre && <div className="text-xs text-gray-400 mb-2">{sousTitre}</div>}
      {lignes.length === 0 ? (
        <div className="text-sm text-gray-400 py-6 text-center">{vide}</div>
      ) : (
        <div className="mt-2 space-y-1">
          {lignes.map((l) => {
            const brut = Number(l.valeur.replace(/\D/g, '')) || 0
            return (
              <div key={l.label} className="relative py-1.5 px-2 rounded overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded"
                  style={{ width: `${(brut / max) * 100}%`, background: 'rgba(34,32,156,0.08)' }}
                />
                <div className="relative flex items-center justify-between gap-3 text-sm">
                  <span className="truncate" title={l.label}>{l.label}</span>
                  <span className="shrink-0 tabular-nums text-gray-600">
                    {l.valeur}
                    {l.detail && <span className="text-gray-400 ml-2">{l.detail}</span>}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function BackstagePerformancePage() {
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState('')

  const charger = useCallback(async (n: number) => {
    setLoading(true)
    setErreur('')
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Session expirée')
      const res = await fetch(`/api/backstage/stats?days=${n}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Lecture impossible')
      setStats(await res.json())
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) charger(days)
    })
    return () => unsub()
  }, [days, charger])

  const t = stats?.totals
  const sessions = t?.sessions || 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: BLEU }}>Performance du site</h1>
          <p className="text-sm text-gray-500">Audience du site public — visites, parcours, conversions.</p>
        </div>
        <div className="flex gap-1">
          {[7, 30, 90].map((n) => (
            <button
              key={n}
              onClick={() => setDays(n)}
              className={`px-3 py-1.5 text-sm rounded border transition ${
                days === n ? 'text-white' : 'bg-white text-gray-600 hover:border-gray-400'
              }`}
              style={days === n ? { background: BLEU, borderColor: BLEU } : undefined}
            >
              {n} j
            </button>
          ))}
        </div>
      </div>

      {erreur && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{erreur}</div>
      )}

      {loading && !stats ? (
        <div className="py-20 flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: BLEU }} />
        </div>
      ) : !stats ? null : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Visites" value={formatPrix(sessions)} sub={`${formatPrix(stats.devices.mobile)} mobile · ${formatPrix(stats.devices.desktop)} ordi`} />
            <Kpi label="Pages vues" value={formatPrix(t!.pageviews)} sub={`${sessions ? (t!.pageviews / sessions).toFixed(1).replace('.', ',') : '0'} pages / visite`} />
            <Kpi label="Paniers" value={formatPrix(t!.addToCart)} sub={`${pourcent(t!.addToCart, sessions)} des visites`} />
            <Kpi label="Commandes" value={formatPrix(t!.conversions)} sub={`${pourcent(t!.conversions, sessions)} de conversion`} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Chiffre d'affaires" value={formatPrixEuro(t!.revenue)} sub={`sur ${days} jours`} />
            <Kpi label="Checkout démarrés" value={formatPrix(t!.checkoutStart)} sub={`${pourcent(t!.conversions, t!.checkoutStart)} finalisés`} />
            <Kpi label="Panier moyen" value={formatPrixEuro(t!.conversions ? t!.revenue / t!.conversions : 0)} />
            <Kpi label="Recherches" value={formatPrix(t!.searchCount)} sub={`${stats.recherches.length} termes différents`} />
          </div>

          {/* Courbe visites */}
          <div className="bg-white border rounded-lg p-4">
            <div className="font-semibold text-sm mb-3">Visites par jour</div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.parJour} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gVisites" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BLEU} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={BLEU} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={jourCourt} tick={{ fontSize: 11, fill: '#999' }} tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis tick={{ fontSize: 11, fill: '#999' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    labelFormatter={jourCourt}
                    formatter={(v: number, name: string) => [formatPrix(v), name === 'sessions' ? 'Visites' : 'Pages vues']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #eee' }}
                  />
                  <Area type="monotone" dataKey="sessions" stroke={BLEU} strokeWidth={2} fill="url(#gVisites)" />
                  <Area type="monotone" dataKey="pageviews" stroke="#bbb" strokeWidth={1} fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Entonnoir */}
          <div className="bg-white border rounded-lg p-4">
            <div className="font-semibold text-sm mb-3">Entonnoir de vente</div>
            <div className="space-y-2">
              {[
                { label: 'Visites', n: sessions },
                { label: 'Ajout au panier', n: t!.addToCart },
                { label: 'Checkout démarré', n: t!.checkoutStart },
                { label: 'Commande payée', n: t!.conversions },
              ].map((etape) => (
                <div key={etape.label} className="relative h-9 rounded overflow-hidden bg-gray-50">
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{ width: `${sessions ? (etape.n / sessions) * 100 : 0}%`, background: 'rgba(34,32,156,0.15)' }}
                  />
                  <div className="relative h-full flex items-center justify-between px-3 text-sm">
                    <span>{etape.label}</span>
                    <span className="tabular-nums">
                      <strong>{formatPrix(etape.n)}</strong>
                      <span className="text-gray-400 ml-2">{pourcent(etape.n, sessions)}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            <Classement
              titre="Pages les plus vues"
              lignes={stats.pages.slice(0, 20).map((p) => ({
                label: p.page,
                valeur: formatPrix(p.vues),
                detail: duree(p.tempsMoyenMs),
              }))}
              vide="Pas encore de données."
            />
            <Classement
              titre="Pages où l'on reste le plus longtemps"
              sousTitre="Temps moyen par vue — pages vues au moins 3 fois"
              lignes={stats.pagesLongues.map((p) => ({
                label: p.page,
                valeur: duree(p.tempsMoyenMs),
                detail: `${formatPrix(p.vues)} vues`,
              }))}
              vide="Pas encore de données."
            />
            <Classement
              titre="Pages d'entrée"
              sousTitre="Première page de la visite"
              lignes={stats.entrees.map((e) => ({ label: e.page, valeur: formatPrix(e.n) }))}
              vide="Pas encore de données."
            />
            <Classement
              titre="Pages de sortie"
              sousTitre="Dernière page avant de quitter le site"
              lignes={stats.sorties.map((e) => ({ label: e.page, valeur: formatPrix(e.n) }))}
              vide="Pas encore de données."
            />
            <Classement
              titre="Mots recherchés"
              sousTitre="Saisis dans la barre de recherche de la boutique"
              lignes={stats.recherches.slice(0, 25).map((s) => ({ label: s.terme, valeur: formatPrix(s.n) }))}
              vide="Aucune recherche pour l'instant."
            />
            <Classement
              titre="Provenance"
              sousTitre="Site d'où viennent les visiteurs"
              lignes={stats.sources.map((s) => ({ label: s.source, valeur: formatPrix(s.n) }))}
              vide="Pas encore de données."
            />
            <Classement
              titre="Villes"
              sousTitre="D'où se connectent les visiteurs"
              lignes={(stats.villes || []).map((v) => ({ label: v.ville, valeur: formatPrix(v.n) }))}
              vide="Pas encore de données."
            />
            <Classement
              titre="Pays"
              sousTitre="Répartition par pays"
              lignes={(stats.pays || []).map((p) => ({ label: p.pays, valeur: formatPrix(p.n) }))}
              vide="Pas encore de données."
            />
          </div>

          <p className="text-xs text-gray-400">
            Mesure maison, sans cookie ni service tiers. Une visite = un onglet ouvert.
            Les données sont agrégées par jour (fuseau Paris).
          </p>
        </>
      )}
    </div>
  )
}
