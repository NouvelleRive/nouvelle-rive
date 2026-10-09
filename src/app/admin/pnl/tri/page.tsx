'use client'

// /admin/pnl/tri — affecter une catégorie aux transactions bancaires qui n'en
// ont pas. On travaille par libellé récurrent : une règle « le libellé contient
// X → catégorie Y » vaut pour toutes les lignes passées et futures.
// Les règles vivent chez nous ; l'application écrit la catégorie dans Pennylane.

import { useCallback, useEffect, useState } from 'react'
import { auth } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { formatPrix } from '@/lib/formatPrix'
import { RefreshCw, Trash2, AlertTriangle, Check } from 'lucide-react'
import type { Regle } from '@/lib/pnlRegles'

type Categorie = { id: number; label: string; direction: 'cash_in' | 'cash_out' }
type Groupe = {
  libelle: string; exemple: string; nb: number; total: number
  sens: 'cash_in' | 'cash_out' | 'mixte'; regle: Regle | null
}
type Data = {
  depuis: string
  categories: Categorie[]
  regles: Regle[]
  stats: { transactions: number; sansCategorie: number; couvertesParUneRegle: number; groupes: number }
  groupes: Groupe[]
}

export default function TriPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [choix, setChoix] = useState<Record<string, string>>({})

  const appel = useCallback(async (methode: 'GET' | 'POST', corps?: any) => {
    const user = auth.currentUser
    if (!user) throw new Error('non connectée')
    const token = await user.getIdToken()
    const res = await fetch('/api/admin/pnl/tri', {
      method: methode,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: corps ? JSON.stringify(corps) : undefined,
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'erreur')
    return json
  }, [])

  const charger = useCallback(async () => {
    setLoading(true); setErreur(null)
    try { setData(await appel('GET')) } catch (e: any) { setErreur(e?.message) } finally { setLoading(false) }
  }, [appel])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { if (u) charger() })
    return () => unsub()
  }, [charger])

  const creerRegle = async (g: Groupe) => {
    const categorieId = Number(choix[g.libelle])
    if (!categorieId) return
    const cat = data?.categories.find(c => c.id === categorieId)
    setEnCours(true); setErreur(null); setMessage(null)
    try {
      await appel('POST', {
        action: 'ajouter-regle',
        motif: g.libelle,
        categorieId,
        categorieLabel: cat?.label || '',
        sens: g.sens === 'mixte' ? null : g.sens,
      })
      await charger()
    } catch (e: any) { setErreur(e?.message) } finally { setEnCours(false) }
  }

  const supprimerRegle = async (id: string) => {
    setEnCours(true)
    try { await appel('POST', { action: 'supprimer-regle', id }); await charger() }
    catch (e: any) { setErreur(e?.message) } finally { setEnCours(false) }
  }

  const appliquer = async (simulation: boolean, limite = 0) => {
    setEnCours(true); setErreur(null); setMessage(null)
    try {
      const r = await appel('POST', { action: 'appliquer', simulation, limite })
      if (simulation) {
        setMessage(`${r.nb} transaction${r.nb > 1 ? 's' : ''} seraient catégorisées. Rien n'a été écrit.`)
      } else {
        const err = r.erreurs?.length ? ` — ${r.erreurs.length} erreur(s) : ${r.erreurs[0]?.erreur}` : ''
        setMessage(`${r.traitees} transaction${r.traitees > 1 ? 's' : ''} catégorisées dans Pennylane.${err}`)
        await charger()
      }
    } catch (e: any) { setErreur(e?.message) } finally { setEnCours(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[#22209C]">Tri des transactions</h1>
          <p className="text-sm text-gray-500">
            Une règle par libellé récurrent. L&apos;application pose la catégorie dans Pennylane,
            uniquement sur les lignes qui n&apos;en ont pas.
          </p>
        </div>
        <button
          onClick={charger}
          disabled={loading || enCours}
          className="flex items-center gap-1.5 border border-gray-300 rounded px-3 py-1.5 text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {erreur && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />{erreur}
        </div>
      )}
      {message && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
          <Check size={16} className="mt-0.5 shrink-0" />{message}
        </div>
      )}

      {loading && !data && <div className="text-sm text-gray-400">Chargement des transactions…</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Transactions" valeur={data.stats.transactions} sous={`depuis le ${data.depuis}`} />
            <Stat label="Sans catégorie" valeur={data.stats.sansCategorie} />
            <Stat label="Couvertes par une règle" valeur={data.stats.couvertesParUneRegle} accent />
            <Stat label="Libellés à trier" valeur={data.stats.groupes} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => appliquer(true)}
              disabled={enCours || !data.stats.couvertesParUneRegle}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Simuler
            </button>
            <button
              onClick={() => appliquer(false, 3)}
              disabled={enCours || !data.stats.couvertesParUneRegle}
              className="border border-[#22209C] text-[#22209C] rounded px-3 py-1.5 text-sm bg-white hover:bg-blue-50 disabled:opacity-50"
            >
              Appliquer sur 3 lignes
            </button>
            <button
              onClick={() => {
                if (confirm(`Poser la catégorie sur ${data.stats.couvertesParUneRegle} transactions dans Pennylane ?`)) appliquer(false)
              }}
              disabled={enCours || !data.stats.couvertesParUneRegle}
              className="bg-[#22209C] text-white rounded px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
            >
              Tout appliquer
            </button>
            {enCours && <span className="text-sm text-gray-400">en cours…</span>}
          </div>

          {data.regles.length > 0 && (
            <section className="bg-white border rounded-lg">
              <div className="px-4 py-2 border-b text-xs font-semibold uppercase tracking-wide text-gray-500">
                Règles ({data.regles.length})
              </div>
              {data.regles.map(r => (
                <div key={r.id} className="flex items-center justify-between px-4 py-2 border-b last:border-b-0 text-sm">
                  <span className="truncate">
                    <span className="text-gray-400">contient</span> <span className="font-medium">{r.motif}</span>
                    <span className="text-gray-400"> → </span>{r.categorieLabel}
                    {r.sens && <span className="text-xs text-gray-400 ml-2">{r.sens === 'cash_in' ? 'entrées' : 'sorties'}</span>}
                  </span>
                  <button onClick={() => supprimerRegle(r.id)} className="text-gray-400 hover:text-red-600 shrink-0 ml-3" title="Supprimer">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </section>
          )}

          <section className="bg-white border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b text-xs font-semibold uppercase tracking-wide text-gray-500">
              Libellés sans catégorie
            </div>
            {data.groupes.map(g => (
              <div key={g.libelle} className="flex items-center gap-3 px-4 py-2 border-b last:border-b-0 text-sm">
                <span className="w-12 text-right tabular-nums text-gray-400 shrink-0">{g.nb}×</span>
                <span className="flex-1 truncate" title={g.exemple}>{g.libelle || '(sans libellé)'}</span>
                <span className={`w-28 text-right tabular-nums shrink-0 ${g.total < 0 ? 'text-gray-700' : 'text-green-600'}`}>
                  {formatPrix(g.total)} €
                </span>
                {g.regle ? (
                  <span className="w-56 text-right text-xs text-[#22209C] shrink-0">→ {g.regle.categorieLabel}</span>
                ) : (
                  <span className="flex items-center gap-2 shrink-0">
                    <select
                      value={choix[g.libelle] || ''}
                      onChange={e => setChoix(c => ({ ...c, [g.libelle]: e.target.value }))}
                      className="border border-gray-300 rounded px-2 py-1 text-xs bg-white w-44"
                    >
                      <option value="">Catégorie…</option>
                      {data.categories
                        .filter(c => g.sens === 'mixte' || c.direction === g.sens)
                        .map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <button
                      onClick={() => creerRegle(g)}
                      disabled={!choix[g.libelle] || enCours}
                      className="border border-gray-300 rounded px-2 py-1 text-xs bg-white hover:bg-gray-50 disabled:opacity-40"
                    >
                      Règle
                    </button>
                  </span>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}

function Stat({ label, valeur, sous, accent }: { label: string; valeur: number; sous?: string; accent?: boolean }) {
  return (
    <div className={`border rounded-lg p-3 ${accent ? 'bg-[#22209C] text-white border-[#22209C]' : 'bg-white'}`}>
      <div className={`text-xs ${accent ? 'opacity-80' : 'text-gray-500'}`}>{label}</div>
      <div className="text-lg font-semibold tabular-nums">{formatPrix(valeur)}</div>
      {sous && <div className={`text-xs ${accent ? 'opacity-70' : 'text-gray-400'}`}>{sous}</div>}
    </div>
  )
}
