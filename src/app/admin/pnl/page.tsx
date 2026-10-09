'use client'

// /admin/pnl — Financials > P&L.
// Le réel, lu dans la compta Pennylane (balance générale) et les soldes des
// comptes bancaires qu'elle agrège. Aucune estimation maison ici : si un
// chiffre est faux, c'est la compta qu'il faut corriger.

import { useCallback, useEffect, useState } from 'react'
import { auth } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { formatPrix } from '@/lib/formatPrix'
import { RefreshCw, ChevronRight, AlertTriangle } from 'lucide-react'

type Compte = { number: string; label: string; montant: number }
type Poste = { cle: string; label: string; sens: 'produit' | 'charge'; montant: number; comptes: Compte[] }
type Mois = {
  cle: string
  produits: number
  charges: number
  resultat: number
  postes: Record<string, number>
  pieces: number
  caVentes: number | null
}
type Data = {
  periode: { start: string; end: string }
  exercices: { start: string; finish: string; status: string }[]
  tresorerie: { comptes: { id: number; nom: string; solde: number; devise: string; majLe: string }[]; total: number }
  pnl: { postes: Poste[]; produits: number; charges: number; resultat: number }
  mois: Mois[]
}

const moisFr = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

// '2026-03' -> 'mars 26'
const libelleMois = (cle: string) => {
  const [an, mo] = cle.split('-')
  const nom = new Date(Number(an), Number(mo) - 1, 1).toLocaleDateString('fr-FR', { month: 'short' })
  return `${nom.replace('.', '')} ${an.slice(2)}`
}

export default function PnlPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [periode, setPeriode] = useState<{ start: string; end: string } | null>(null)
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({})
  const [vue, setVue] = useState<'cumul' | 'mois'>('cumul')

  const charger = useCallback(async (p?: { start: string; end: string } | null) => {
    setLoading(true)
    setErreur(null)
    try {
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const qs = p ? `?start=${p.start}&end=${p.end}` : ''
      const res = await fetch(`/api/admin/pnl${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'erreur')
      setData(json)
      setPeriode(json.periode)
    } catch (e: any) {
      setErreur(e?.message || 'erreur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { if (u) charger(null) })
    return () => unsub()
  }, [charger])

  const produits = data?.pnl.postes.filter(p => p.sens === 'produit') || []
  const charges = data?.pnl.postes.filter(p => p.sens === 'charge') || []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[#22209C]">P&amp;L</h1>
          <p className="text-sm text-gray-500">
            Compta Pennylane
            {data && <> — du {moisFr(data.periode.start)} au {moisFr(data.periode.end)}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-gray-300 overflow-hidden text-sm">
            {(['cumul', 'mois'] as const).map(v => (
              <button
                key={v}
                onClick={() => setVue(v)}
                className={`px-3 py-1.5 ${vue === v ? 'bg-[#22209C] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {v === 'cumul' ? 'Cumul' : 'Par mois'}
              </button>
            ))}
          </div>
          {data && data.exercices.length > 1 && (
            <select
              value={periode ? `${periode.start}|${periode.end}` : ''}
              onChange={(e) => {
                const [start, end] = e.target.value.split('|')
                setPeriode({ start, end })
                charger({ start, end })
              }}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
            >
              {periode && !data.exercices.some(e => e.start === periode.start && e.finish === periode.end) && (
                <option value={`${periode.start}|${periode.end}`}>
                  {moisFr(periode.start)} → {moisFr(periode.end)}
                </option>
              )}
              {data.exercices.map(e => (
                <option key={e.start} value={`${e.start}|${e.finish}`}>
                  Exercice {e.start.slice(0, 4)}{e.start.slice(5, 7) !== '01' ? ` (dès ${moisFr(e.start)})` : ''}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => charger(periode)}
            disabled={loading}
            className="flex items-center gap-1.5 border border-gray-300 rounded px-3 py-1.5 text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {erreur && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{erreur}</span>
        </div>
      )}

      {loading && !data && <div className="text-sm text-gray-400">Chargement…</div>}

      {data && (
        <>
          {/* Trésorerie — le réel bancaire */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Trésorerie</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {data.tresorerie.comptes.map(c => (
                <div key={c.id} className="bg-white border rounded-lg p-3">
                  <div className="text-xs text-gray-500 truncate" title={c.nom}>{c.nom}</div>
                  <div className="text-lg font-semibold tabular-nums">{formatPrix(c.solde, { decimals: 0 })} €</div>
                </div>
              ))}
              <div className="bg-[#22209C] text-white rounded-lg p-3">
                <div className="text-xs opacity-80">Total</div>
                <div className="text-lg font-semibold tabular-nums">{formatPrix(data.tresorerie.total, { decimals: 0 })} €</div>
              </div>
            </div>
          </section>

          {/* Compte de résultat */}
          {vue === 'cumul' ? (
            <section className="bg-white border rounded-lg overflow-hidden">
              <BlocPostes titre="Produits" postes={produits} total={data.pnl.produits} ouverts={ouverts} setOuverts={setOuverts} />
              <BlocPostes titre="Charges" postes={charges} total={data.pnl.charges} ouverts={ouverts} setOuverts={setOuverts} />
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
                <span className="font-semibold">Résultat</span>
                <span className={`text-lg font-semibold tabular-nums ${data.pnl.resultat >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPrix(data.pnl.resultat, { decimals: 0 })} €
                </span>
              </div>
            </section>
          ) : (
            <TableauMois data={data} produits={produits} charges={charges} />
          )}
        </>
      )}
    </div>
  )
}

function BlocPostes({
  titre, postes, total, ouverts, setOuverts,
}: {
  titre: string
  postes: Poste[]
  total: number
  ouverts: Record<string, boolean>
  setOuverts: (f: (o: Record<string, boolean>) => Record<string, boolean>) => void
}) {
  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titre}</span>
        <span className="text-sm font-semibold tabular-nums">{formatPrix(total, { decimals: 0 })} €</span>
      </div>
      {postes.length === 0 && <div className="px-4 py-3 text-sm text-gray-400">Aucun mouvement</div>}
      {postes.map(p => {
        const ouvert = !!ouverts[p.cle]
        return (
          <div key={p.cle}>
            <button
              onClick={() => setOuverts(o => ({ ...o, [p.cle]: !o[p.cle] }))}
              className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-left"
            >
              <span className="flex items-center gap-1.5 text-sm">
                <ChevronRight size={14} className={`text-gray-400 transition-transform ${ouvert ? 'rotate-90' : ''}`} />
                {p.label}
                <span className="text-xs text-gray-400">({p.comptes.length})</span>
              </span>
              <span className="text-sm tabular-nums">{formatPrix(p.montant, { decimals: 0 })} €</span>
            </button>
            {ouvert && (
              <div className="bg-gray-50/50">
                {p.comptes.map(c => (
                  <div key={c.number} className="flex items-center justify-between pl-11 pr-4 py-1.5 text-xs text-gray-600">
                    <span className="truncate" title={`${c.number} — ${c.label}`}>
                      <span className="text-gray-400 mr-2 tabular-nums">{c.number}</span>
                      {c.label}
                    </span>
                    <span className="tabular-nums shrink-0 ml-3">{formatPrix(c.montant, { decimals: 0 })} €</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Vue mois par mois : les postes en lignes, les mois en colonnes.
// Le tableau scrolle horizontalement, la 1re colonne reste collée.
function TableauMois({ data, produits, charges }: { data: Data; produits: Poste[]; charges: Poste[] }) {
  const mois = data.mois
  const cel = 'px-3 py-1.5 text-right tabular-nums whitespace-nowrap'
  const tete = 'sticky left-0 bg-white px-3 py-1.5 text-left whitespace-nowrap z-10'

  const Ligne = ({ label, valeurs, total, gras, couleur, suffixe }: {
    label: string
    valeurs: number[]
    total: number
    gras?: boolean
    couleur?: boolean
    suffixe?: string
  }) => (
    <tr className={`border-t ${gras ? 'font-semibold' : ''}`}>
      <td className={`${tete} ${gras ? 'font-semibold' : ''}`}>{label}</td>
      {valeurs.map((v, i) => (
        <td key={i} className={`${cel} ${couleur && v < 0 ? 'text-red-600' : couleur && v > 0 ? 'text-green-600' : ''}`}>
          {suffixe === 'pieces' ? formatPrix(v) : `${formatPrix(v, { decimals: 0 })} €`}
        </td>
      ))}
      <td className={`${cel} bg-gray-50 ${gras ? '' : 'font-medium'}`}>
        {suffixe === 'pieces' ? formatPrix(total) : `${formatPrix(total, { decimals: 0 })} €`}
      </td>
    </tr>
  )

  const somme = (f: (m: Mois) => number) => mois.reduce((s, m) => s + f(m), 0)

  return (
    <section className="bg-white border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <th className={`${tete} bg-gray-50 font-semibold`}>&nbsp;</th>
            {mois.map(m => <th key={m.cle} className={`${cel} font-semibold`}>{libelleMois(m.cle)}</th>)}
            <th className={`${cel} font-semibold bg-gray-100`}>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-gray-50/70">
            <td className={`${tete} bg-gray-50 text-xs uppercase tracking-wide text-gray-500 font-semibold`} colSpan={mois.length + 2}>Produits</td>
          </tr>
          {produits.map(p => (
            <Ligne key={p.cle} label={p.label} valeurs={mois.map(m => m.postes[p.cle] ?? 0)} total={p.montant} />
          ))}
          <Ligne label="Total produits" valeurs={mois.map(m => m.produits)} total={data.pnl.produits} gras />

          <tr className="bg-gray-50/70">
            <td className={`${tete} bg-gray-50 text-xs uppercase tracking-wide text-gray-500 font-semibold`} colSpan={mois.length + 2}>Charges</td>
          </tr>
          {charges.map(p => (
            <Ligne key={p.cle} label={p.label} valeurs={mois.map(m => m.postes[p.cle] ?? 0)} total={p.montant} />
          ))}
          <Ligne label="Total charges" valeurs={mois.map(m => m.charges)} total={data.pnl.charges} gras />

          <tr className="bg-gray-50/70">
            <td className={`${tete} bg-gray-50 text-xs uppercase tracking-wide text-gray-500 font-semibold`} colSpan={mois.length + 2}>Résultat</td>
          </tr>
          <Ligne label="Résultat" valeurs={mois.map(m => m.resultat)} total={data.pnl.resultat} gras couleur />

          <tr className="bg-gray-50/70">
            <td className={`${tete} bg-gray-50 text-xs uppercase tracking-wide text-gray-500 font-semibold`} colSpan={mois.length + 2}>
              Volumes <span className="normal-case tracking-normal text-gray-400">— nos ventes, pas la compta</span>
            </td>
          </tr>
          <Ligne label="Pièces vendues" valeurs={mois.map(m => m.pieces)} total={somme(m => m.pieces)} suffixe="pieces" />
          {mois.some(m => m.caVentes !== null) && (
            <>
              <Ligne label="CA encaissé" valeurs={mois.map(m => m.caVentes ?? 0)} total={somme(m => m.caVentes ?? 0)} />
              <Ligne
                label="Panier moyen"
                valeurs={mois.map(m => (m.pieces ? (m.caVentes ?? 0) / m.pieces : 0))}
                total={somme(m => m.pieces) ? somme(m => m.caVentes ?? 0) / somme(m => m.pieces) : 0}
              />
            </>
          )}
        </tbody>
      </table>
    </section>
  )
}
