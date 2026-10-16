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
type SousLigne = { cle: string; label: string; titre?: string; montant: number; mois?: string; horsNR?: boolean }
type Poste = { cle: string; label: string; titre?: string; sens: 'produit' | 'charge'; montant: number; comptes: Compte[]; sousLignes?: SousLigne[] }
type PosteSimple = { cle: string; label: string; titre?: string; montant: number; comptes: Compte[]; sousLignes?: SousLigne[] }
type Mois = {
  cle: string
  produits: number
  charges: number
  resultat: number
  postes: Record<string, number>
  margeBrute: number | null
  tauxCommission: number | null
  pieces: number
  caVentes: number | null
}
type Data = {
  periode: { start: string; end: string }
  exercices: { start: string; finish: string; status: string }[]
  tresorerie: { comptes: { id: number; nom: string; solde: number; devise: string; majLe: string; pri: boolean }[]; total: number; totalAvecPri: number }
  pnl: {
    postes: Poste[]
    depotVente: PosteSimple[]
    commissionsBrutes: number
    commissionsDeduites: number
    margeBrute: number | null
    margeBruteBrute: number | null
    tauxCommission: number | null
    produits: number
    charges: number
    resultat: number
  }
  calculeLe?: string
  ducache?: boolean
  parChineuse: { nom: string; trigramme: string; taux: number; pieces: number; volume: number | null; commission: number | null }[]
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

// Exercice, vue et case Printemps survivent au rafraîchissement. On les écrit
// dans l'URL — le lien reste partageable — et dans sessionStorage, qui prend le
// relais si la navigation Next remet l'URL à nu. Rien côté serveur, donc rien
// à payer.
const CLE_ETAT = 'nr-pnl-filtres'

type EtatPnl = { periode: { start: string; end: string } | null; vue: 'cumul' | 'mois'; pri: boolean }

function etatUrl(): EtatPnl {
  const vide: EtatPnl = { periode: null, vue: 'cumul', pri: false }
  if (typeof window === 'undefined') return vide

  const p = new URLSearchParams(window.location.search)
  const start = p.get('start')
  const end = p.get('end')
  if (start && end) {
    return {
      periode: { start, end },
      vue: p.get('vue') === 'mois' ? 'mois' : 'cumul',
      pri: p.get('pri') === '1',
    }
  }

  try {
    const brut = sessionStorage.getItem(CLE_ETAT)
    if (brut) {
      const e = JSON.parse(brut) as EtatPnl
      if (e?.periode?.start && e?.periode?.end) {
        return { periode: e.periode, vue: e.vue === 'mois' ? 'mois' : 'cumul', pri: !!e.pri }
      }
    }
  } catch { /* sessionStorage indisponible */ }

  return vide
}

export default function PnlPage() {
  const initial = etatUrl()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [periode, setPeriode] = useState<{ start: string; end: string } | null>(initial.periode)
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({})
  const [vue, setVue] = useState<'cumul' | 'mois'>(initial.vue)
  const [inclurePri, setInclurePri] = useState(initial.pri)

  // Reflète l'état courant dans l'URL sans recharger la page.
  useEffect(() => {
    const p = new URLSearchParams()
    if (periode) { p.set('start', periode.start); p.set('end', periode.end) }
    if (vue === 'mois') p.set('vue', 'mois')
    if (inclurePri) p.set('pri', '1')
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
    try { sessionStorage.setItem(CLE_ETAT, JSON.stringify({ periode, vue, pri: inclurePri })) } catch { /* ignore */ }
  }, [periode, vue, inclurePri])

  const charger = useCallback(async (p?: { start: string; end: string } | null, forcer = false) => {
    setLoading(true)
    setErreur(null)
    try {
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const params = new URLSearchParams()
      if (p) { params.set('start', p.start); params.set('end', p.end) }
      if (forcer) params.set('refresh', '1')
      const qs = params.toString() ? `?${params}` : ''
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
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) return
      const e = etatUrl()
      setVue(e.vue)
      setInclurePri(e.pri)
      charger(e.periode)
    })
    return () => unsub()
  }, [charger])

  const produits = data?.pnl.postes.filter(p => p.sens === 'produit') || []
  const charges = data?.pnl.postes.filter(p => p.sens === 'charge') || []

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-[#22209C]">P&amp;L</h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <label
            className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 select-none cursor-pointer"
            title="Le compte PRI et les ventes du stand Printemps"
          >
            <input
              type="checkbox"
              checked={inclurePri}
              onChange={(e) => setInclurePri(e.target.checked)}
              className="accent-[#22209C]"
            />
            Inclure le Printemps
          </label>
          <div className="flex rounded border border-gray-300 overflow-hidden text-xs sm:text-sm">
            {(['cumul', 'mois'] as const).map(v => (
              <button
                key={v}
                onClick={() => setVue(v)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 ${vue === v ? 'bg-[#22209C] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
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
              className="border border-gray-300 rounded px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm bg-white"
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
            onClick={() => charger(periode, true)}
            disabled={loading}
            title={data?.calculeLe ? `Chiffres du ${new Date(data.calculeLe).toLocaleString('fr-FR')}` : undefined}
            className="flex items-center gap-1.5 border border-gray-300 rounded px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Mettre à jour
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
              {data.tresorerie.comptes.filter(c => inclurePri || !c.pri).map(c => (
                <div key={c.id} className="bg-white border rounded-lg p-2.5 sm:p-3">
                  <div className="text-xs text-gray-500 truncate" title={c.nom}>{c.nom}</div>
                  <div className="text-base sm:text-lg font-semibold tabular-nums">{formatPrix(c.solde, { decimals: 0 })} €</div>
                </div>
              ))}
              <div className="bg-[#22209C] text-white rounded-lg p-2.5 sm:p-3">
                <div className="text-xs opacity-80">Total</div>
                <div className="text-base sm:text-lg font-semibold tabular-nums">{formatPrix(inclurePri ? data.tresorerie.totalAvecPri : data.tresorerie.total, { decimals: 0 })} €</div>
              </div>
            </div>
          </section>

          {/* Compte de résultat */}
          {vue === 'cumul' ? (
            <section className="bg-white border rounded-lg overflow-x-auto">
              <div className="min-w-[620px]">
              <BlocPostes
                titre="Dépôt-vente"
                postes={data.pnl.depotVente.map(p => ({ ...p, sens: 'produit' as const }))}
                total={null}
                ouverts={ouverts}
                setOuverts={setOuverts}
              />
              <MargeParChineuse lignes={data.parChineuse} />
              {data.pnl.commissionsDeduites > 0 && (
                <>
                  <div className="flex items-center justify-between px-3 sm:px-4 py-1 sm:py-1.5 border-b text-xs sm:text-sm" title="Crédits des comptes 70 : les commissions facturées">
                    <span className="pl-5 text-gray-600">Commissions brutes</span>
                    <span className="tabular-nums text-gray-600">{formatPrix(data.pnl.commissionsBrutes)} €</span>
                  </div>
                  <div className="flex items-center justify-between px-3 sm:px-4 py-1 sm:py-1.5 border-b text-xs sm:text-sm" title="Débits des comptes 70 : la part commission des factures chineuses, passée au débit par la règle fournisseur">
                    <span className="pl-5 text-gray-600">dont venant en déduction</span>
                    <span className="tabular-nums text-red-600">− {formatPrix(data.pnl.commissionsDeduites)} €</span>
                  </div>
                </>
              )}
              {data.pnl.margeBrute != null && (
                <div
                  className="flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 border-b bg-blue-50/40"
                  title="Commissions perçues ÷ volume chineuses TTC"
                >
                  <span className="text-xs sm:text-sm font-medium">Marge brute</span>
                  <span className="text-xs sm:text-sm font-semibold tabular-nums">
                    {data.pnl.margeBrute.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %
                    {data.pnl.margeBruteBrute != null && (
                      <span className="font-normal text-gray-400 ml-2">
                        ({data.pnl.margeBruteBrute.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % sur les commissions brutes)
                      </span>
                    )}
                  </span>
                </div>
              )}
              {data.pnl.tauxCommission != null && (
                <div
                  className="flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 border-b bg-blue-50/40"
                  title="706101 seul ÷ volume chineuses TTC"
                >
                  <span className="text-xs sm:text-sm font-medium">Taux de commission réel</span>
                  <span className="text-xs sm:text-sm font-semibold tabular-nums">
                    {data.pnl.tauxCommission.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %
                  </span>
                </div>
              )}
              <BlocPostes titre="Produits" postes={produits} total={data.pnl.produits} ouverts={ouverts} setOuverts={setOuverts} />
              <BlocPostes titre="Charges" postes={charges} total={data.pnl.charges} ouverts={ouverts} setOuverts={setOuverts} />
              <div className="flex items-center justify-between px-3 sm:px-4 py-3 bg-gray-50 border-t">
                <span className="font-semibold">Résultat</span>
                <span className={`text-lg font-semibold tabular-nums ${data.pnl.resultat >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPrix(data.pnl.resultat, { decimals: 0 })} €
                </span>
              </div>
              </div>
            </section>
          ) : (
            <TableauMois data={data} produits={produits} charges={charges} ouverts={ouverts} setOuverts={setOuverts} />
          )}
        </>
      )}
    </div>
  )
}

// Marge brute moyenne sous les reversements, dépliable par chineuse. Le volume
// vient de nos ventes Square — le trigramme du SKU dit à qui appartient la
// pièce — et la commission applique son taux. Les comptes 467 ne pourraient pas
// répondre : ils ne portent que ce qui a déjà été reversé.
function MargeParChineuse({ lignes }: { lignes: Data['parChineuse'] }) {
  const [ouvert, setOuvert] = useState(false)
  if (!lignes?.length) return null
  const volume = lignes.reduce((s, l) => s + (l.volume ?? 0), 0)
  const commission = lignes.reduce((s, l) => s + (l.commission ?? 0), 0)
  if (!volume) return null
  const marge = (commission / volume) * 100
  return (
    <>
      <button
        onClick={() => setOuvert(o => !o)}
        className="w-full flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 border-b bg-blue-50/40 hover:bg-blue-50 text-left"
        title="Source : Square, par trigramme de SKU"
      >
        <span className="text-xs sm:text-sm font-medium">
          <span className="inline-block w-3 text-gray-400">{ouvert ? '−' : '+'}</span>
          Marge brute moyenne
        </span>
        <span className="text-xs sm:text-sm font-semibold tabular-nums">
          {marge.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %
          <span className="font-normal text-gray-400 ml-2">
            {formatPrix(commission, { decimals: 0 })} € sur {formatPrix(volume, { decimals: 0 })} €
          </span>
        </span>
      </button>
      {ouvert && (
        <div className="bg-gray-50/60 border-b">
          <div className="flex items-center px-3 sm:px-4 py-1 text-[10px] sm:text-[11px] uppercase tracking-wide text-gray-400 border-b">
            <span className="flex-1">Chineuse</span>
            <span className="w-12 sm:w-20 text-right">Pièces</span>
            <span className="w-20 sm:w-28 text-right">Volume</span>
            <span className="w-20 sm:w-28 text-right hidden sm:block">Commission</span>
            <span className="w-12 sm:w-16 text-right">Marge</span>
          </div>
          {lignes.map(l => (
            <div key={l.trigramme} className="flex items-center px-3 sm:px-4 py-1 sm:py-1.5 border-b last:border-b-0 text-xs sm:text-sm">
              <span className="flex-1 pl-1 sm:pl-3 text-gray-700 whitespace-nowrap">{l.nom}</span>
              <span className="w-12 sm:w-20 text-right tabular-nums text-gray-500">{formatPrix(l.pieces)}</span>
              <span className="w-20 sm:w-28 text-right tabular-nums">{formatPrix(l.volume ?? 0, { decimals: 0 })} €</span>
              <span className="w-20 sm:w-28 text-right tabular-nums hidden sm:block">{formatPrix(l.commission ?? 0, { decimals: 0 })} €</span>
              <span className="w-12 sm:w-16 text-right tabular-nums text-gray-500">{l.taux} %</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function BlocPostes({
  titre, postes, total, ouverts, setOuverts,
}: {
  titre: string
  postes: Poste[]
  total?: number | null
  ouverts: Record<string, boolean>
  setOuverts: (f: (o: Record<string, boolean>) => Record<string, boolean>) => void
}) {
  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-gray-50 border-b">
        <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-gray-500">{titre}</span>
        {total != null && <span className="text-xs sm:text-sm font-semibold tabular-nums">{formatPrix(total, { decimals: 0 })} €</span>}
      </div>
      {postes.length === 0 && <div className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-400">Aucun mouvement</div>}
      {postes.map(p => {
        const sous = p.sousLignes ?? []
        const depliable = p.comptes.length > 0 || sous.length > 0
        const ouvert = depliable && !!ouverts[p.cle]
        return (
          <div key={p.cle}>
            <button
              onClick={() => depliable && setOuverts(o => ({ ...o, [p.cle]: !o[p.cle] }))}
              className={`w-full flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 text-left ${depliable ? 'hover:bg-gray-50' : 'cursor-default'}`}
            >
              <span className="flex items-center gap-1.5 text-xs sm:text-sm min-w-0" title={p.titre}>
                <ChevronRight
                  size={14}
                  className={`transition-transform ${ouvert ? 'rotate-90' : ''} ${depliable ? 'text-gray-400' : 'text-transparent'}`}
                />
                <span className="whitespace-nowrap">{p.label}</span>
                {depliable && <span className="text-[11px] text-gray-400 shrink-0">({p.comptes.length || sous.length})</span>}
              </span>
              <span className="text-xs sm:text-sm tabular-nums shrink-0 ml-2">{formatPrix(p.montant, { decimals: 0 })} €</span>
            </button>
            {ouvert && (
              <div className={`bg-gray-50/50 ${sous.length > 20 ? 'max-h-80 overflow-y-auto' : ''}`}>
                {sous.map(sl => (
                  <div key={sl.cle} className="flex items-center justify-between pl-8 sm:pl-11 pr-3 sm:pr-4 py-1 sm:py-1.5 text-[11px] sm:text-xs text-gray-600">
                    <span className="whitespace-nowrap" title={sl.titre}>{sl.label}</span>
                    <span className="tabular-nums shrink-0 ml-3">{formatPrix(sl.montant, { decimals: 0 })} €</span>
                  </div>
                ))}
                {/* Les sous-lignes remplacent le détail par compte quand il y en a. */}
                {sous.length === 0 && p.comptes.map(c => (
                  <div key={c.number} className="flex items-center justify-between pl-8 sm:pl-11 pr-3 sm:pr-4 py-1 sm:py-1.5 text-[11px] sm:text-xs text-gray-600">
                    <span className="whitespace-nowrap" title={`${c.number} — ${c.label}`}>
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
function TableauMois({ data, produits, charges, ouverts, setOuverts }: {
  data: Data
  produits: Poste[]
  charges: Poste[]
  ouverts: Record<string, boolean>
  setOuverts: (f: (o: Record<string, boolean>) => Record<string, boolean>) => void
}) {
  const mois = data.mois
  const cel = 'px-2 sm:px-3 py-1 sm:py-1.5 text-right tabular-nums whitespace-nowrap'
  const tete = 'sticky left-0 bg-white px-2 sm:px-3 py-1 sm:py-1.5 text-left whitespace-nowrap z-10'

  const Ligne = ({ label, valeurs, total, gras, couleur, suffixe, titre }: {
    label: string
    valeurs: number[]
    total: number
    gras?: boolean
    couleur?: boolean
    suffixe?: string
    titre?: string
  }) => (
    <tr className={`border-t ${gras ? 'font-semibold' : ''}`}>
      <td className={`${tete} ${gras ? 'font-semibold' : ''}`} title={titre}>{label}</td>
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

  // Une ligne de poste : cliquable quand elle a du détail daté, qu'on répartit
  // alors dans la colonne de son mois.
  const LignePoste = ({ p, dejaAffichees }: { p: Poste | PosteSimple; dejaAffichees?: string[] }) => {
    const sous = p.sousLignes ?? []
    const mensuelles = sous.filter(sl => mois.some(m => m.postes[sl.cle] !== undefined))
      .filter(sl => !(dejaAffichees ?? []).includes(sl.cle))
    const datees = sous.filter(sl => sl.mois)
    const ouvert = datees.length > 0 && !!ouverts[`m-${p.cle}`]
    return (
      <>
        <tr className="border-t">
          <td className={tete} title={p.titre}>
            {datees.length > 0 ? (
              <button
                onClick={() => setOuverts(o => ({ ...o, [`m-${p.cle}`]: !o[`m-${p.cle}`] }))}
                className="flex items-center gap-1 text-left hover:text-[#22209C]"
              >
                <ChevronRight size={12} className={`text-gray-400 transition-transform ${ouvert ? 'rotate-90' : ''}`} />
                {p.label}
                <span className="text-xs text-gray-400">({datees.length})</span>
              </button>
            ) : (
              <span className="pl-4">{p.label}</span>
            )}
          </td>
          {mois.map(m => <td key={m.cle} className={cel}>{formatPrix(m.postes[p.cle] ?? 0, { decimals: 0 })} €</td>)}
          <td className={`${cel} bg-gray-50 font-medium`}>{formatPrix(p.montant, { decimals: 0 })} €</td>
        </tr>
        {mensuelles.map(sl => (
          <Ligne
            key={sl.cle}
            label={`\u00a0\u00a0\u00a0${sl.label}`}
            titre={sl.titre}
            valeurs={mois.map(m => m.postes[sl.cle] ?? 0)}
            total={sl.montant}
          />
        ))}
        {/* Le détail se lit en colonne : sous mars, les pièces de mars. */}
        {ouvert && (
          <tr className="bg-gray-50/50 text-[11px] text-gray-600 align-top">
            <td className={`${tete} bg-gray-50/50 pl-6 text-gray-400`}>Détail</td>
            {mois.map(m => {
              const duMois = datees.filter(sl => sl.mois === m.cle)
              return (
                <td key={m.cle} className="px-2 sm:px-3 py-1.5 text-right align-top">
                  {duMois.length === 0 ? '' : (
                    <div className="text-gray-400 mb-1">{duMois.length} ligne{duMois.length > 1 ? 's' : ''}</div>
                  )}
                  {duMois.map(sl => (
                    <div key={sl.cle} className="flex items-baseline justify-between gap-3 whitespace-nowrap" title={sl.titre}>
                      <span className="text-gray-500">{sl.label}</span>
                      <span className="tabular-nums text-gray-700">{formatPrix(sl.montant, { decimals: 0 })} €</span>
                    </div>
                  ))}
                </td>
              )
            })}
            <td className={`${cel} bg-gray-50 align-top`}>{datees.length} lignes</td>
          </tr>
        )}
      </>
    )
  }

  const somme = (f: (m: Mois) => number) => mois.reduce((s, m) => s + f(m), 0)

  return (
    <section className="bg-white border rounded-lg overflow-x-auto">
      <table className="w-full text-[11px] sm:text-sm">
        <thead>
          <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <th className={`${tete} bg-gray-50 font-semibold`}>&nbsp;</th>
            {mois.map(m => <th key={m.cle} className={`${cel} font-semibold min-w-[160px]`}>{libelleMois(m.cle)}</th>)}
            <th className={`${cel} font-semibold bg-gray-100`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {data.pnl.depotVente.length > 0 && (
            <>
              <tr className="bg-gray-50/70">
                <td className={`${tete} bg-gray-50 text-xs uppercase tracking-wide text-gray-500 font-semibold`} colSpan={mois.length + 2}>Dépôt-vente</td>
              </tr>
              <Ligne label="Pièces vendues" titre="Nos ventes, pas la compta" valeurs={mois.map(m => m.pieces)} total={somme(m => m.pieces)} suffixe="pieces" />
              {data.pnl.depotVente.map(p => (
                <LignePoste key={p.cle} p={p} dejaAffichees={data.pnl.depotVente.map(q => q.cle)} />
              ))}
              <tr className="border-t">
                <td className={tete} title="Commissions perçues ÷ volume chineuses TTC">Marge brute</td>
                {mois.map(m => (
                  <td key={m.cle} className={cel}>
                    {m.margeBrute == null ? '—' : `${m.margeBrute.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`}
                  </td>
                ))}
                <td className={`${cel} bg-gray-50 font-medium`}>
                  {data.pnl.margeBrute == null ? '—' : `${data.pnl.margeBrute.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`}
                </td>
              </tr>
              <tr className="border-t">
                <td className={tete} title="706101 seul ÷ volume chineuses TTC">Taux de commission réel</td>
                {mois.map(m => (
                  <td key={m.cle} className={cel}>
                    {m.tauxCommission == null ? '—' : `${m.tauxCommission.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`}
                  </td>
                ))}
                <td className={`${cel} bg-gray-50 font-medium`}>
                  {data.pnl.tauxCommission == null ? '—' : `${data.pnl.tauxCommission.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`}
                </td>
              </tr>
            </>
          )}

          <tr className="bg-gray-50/70">
            <td className={`${tete} bg-gray-50 text-xs uppercase tracking-wide text-gray-500 font-semibold`} colSpan={mois.length + 2}>Produits</td>
          </tr>
          {produits.map(p => <LignePoste key={p.cle} p={p} />)}
          <Ligne label="Total produits" valeurs={mois.map(m => m.produits)} total={data.pnl.produits} gras />

          <tr className="bg-gray-50/70">
            <td className={`${tete} bg-gray-50 text-xs uppercase tracking-wide text-gray-500 font-semibold`} colSpan={mois.length + 2}>Charges</td>
          </tr>
          {charges.map(p => <LignePoste key={p.cle} p={p} />)}
          <Ligne label="Total charges" valeurs={mois.map(m => m.charges)} total={data.pnl.charges} gras />

          <tr className="bg-gray-50/70">
            <td className={`${tete} bg-gray-50 text-xs uppercase tracking-wide text-gray-500 font-semibold`} colSpan={mois.length + 2}>Résultat</td>
          </tr>
          <Ligne label="Résultat" valeurs={mois.map(m => m.resultat)} total={data.pnl.resultat} gras couleur />

        </tbody>
      </table>
    </section>
  )
}
