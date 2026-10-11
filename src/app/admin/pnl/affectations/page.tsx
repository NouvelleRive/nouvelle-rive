'use client'

// /admin/pnl/affectations — réaffecter les factures tombées sur le compte de
// commissions vers le compte de tiers de la chineuse. Les règles viennent du
// centre de règles de l'app ; ici on voit le résultat avant d'écrire.

import { useCallback, useEffect, useState } from 'react'
import { auth } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { formatPrix } from '@/lib/formatPrix'
import { RefreshCw, AlertTriangle, Check, ChevronRight } from 'lucide-react'

type Ligne = { entryId: number; lineId: number; date: string; montant: number; libelle: string; source: string }
type Groupe = { compte: string; compteLabel: string; nb: number; total: number; lignes: Ligne[] }
type Data = {
  periode: { debut: string; fin: string }
  regles: number
  comptesManquants: string[]
  total: number
  nb: number
  groupes: Groupe[]
}

export default function AffectationsPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({})

  const appel = useCallback(async (methode: 'GET' | 'POST', corps?: any) => {
    const user = auth.currentUser
    if (!user) throw new Error('non connectée')
    const token = await user.getIdToken()
    const res = await fetch('/api/admin/pnl/affectations', {
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

  const appliquer = async (simulation: boolean, limite = 0) => {
    setEnCours(true); setErreur(null); setMessage(null)
    try {
      const r = await appel('POST', { simulation, limite })
      if (simulation) {
        setMessage(`${r.nb} ligne${r.nb > 1 ? 's' : ''} seraient réaffectées, ${formatPrix(r.total)} €. Rien n'a été écrit.`)
      } else {
        const err = r.erreurs?.length ? ` — ${r.erreurs.length} erreur(s) : ${r.erreurs[0]?.erreur}` : ''
        setMessage(`${r.traitees} ligne${r.traitees > 1 ? 's' : ''} réaffectées dans Pennylane.${err}`)
        await charger()
      }
    } catch (e: any) { setErreur(e?.message) } finally { setEnCours(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[#22209C]">Affectations</h1>
          <p className="text-sm text-gray-500">
            Factures tombées sur le compte de commissions, à basculer vers le compte de la chineuse.
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

      {loading && !data && <div className="text-sm text-gray-400">Lecture des écritures…</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Lignes à réaffecter" valeur={formatPrix(data.nb)} />
            <Stat label="Montant" valeur={`${formatPrix(data.total)} €`} accent />
            <Stat label="Chineuses" valeur={formatPrix(data.groupes.length)} />
            <Stat label="Règles actives" valeur={formatPrix(data.regles)} />
          </div>

          {data.comptesManquants.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Comptes introuvables dans Pennylane : {data.comptesManquants.join(', ')}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => appliquer(true)} disabled={enCours || !data.nb}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white hover:bg-gray-50 disabled:opacity-50">
              Simuler
            </button>
            <button onClick={() => appliquer(false, 1)} disabled={enCours || !data.nb}
              className="border border-[#22209C] text-[#22209C] rounded px-3 py-1.5 text-sm bg-white hover:bg-blue-50 disabled:opacity-50">
              Réaffecter 1 ligne
            </button>
            <button
              onClick={() => { if (confirm(`Réaffecter ${data.nb} lignes dans Pennylane (${formatPrix(data.total)} €) ?`)) appliquer(false) }}
              disabled={enCours || !data.nb}
              className="bg-[#22209C] text-white rounded px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-50">
              Tout réaffecter
            </button>
            {enCours && <span className="text-sm text-gray-400">en cours…</span>}
          </div>

          <section className="bg-white border rounded-lg overflow-hidden">
            {data.groupes.length === 0 && (
              <div className="px-4 py-6 text-sm text-gray-400 text-center">Rien à réaffecter sur la période.</div>
            )}
            {data.groupes.map(g => {
              const ouvert = !!ouverts[g.compte]
              return (
                <div key={g.compte} className="border-b last:border-b-0">
                  <button
                    onClick={() => setOuverts(o => ({ ...o, [g.compte]: !o[g.compte] }))}
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-left text-sm"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <ChevronRight size={14} className={`text-gray-400 transition-transform ${ouvert ? 'rotate-90' : ''}`} />
                      <span className="text-gray-400 tabular-nums mr-1">{g.compte}</span>
                      <span className="truncate">{g.compteLabel}</span>
                      <span className="text-xs text-gray-400">({g.nb})</span>
                    </span>
                    <span className="tabular-nums shrink-0 ml-3">{formatPrix(g.total)} €</span>
                  </button>
                  {ouvert && (
                    <div className="bg-gray-50/50">
                      {g.lignes.map(l => (
                        <div key={l.lineId} className="flex items-center justify-between pl-11 pr-4 py-1.5 text-xs text-gray-600">
                          <span className="truncate" title={l.libelle}>
                            <span className="text-gray-400 mr-2 tabular-nums">{l.date}</span>{l.libelle}
                          </span>
                          <span className="tabular-nums shrink-0 ml-3">{formatPrix(l.montant)} €</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        </>
      )}
    </div>
  )
}

function Stat({ label, valeur, accent }: { label: string; valeur: string; accent?: boolean }) {
  return (
    <div className={`border rounded-lg p-3 ${accent ? 'bg-[#22209C] text-white border-[#22209C]' : 'bg-white'}`}>
      <div className={`text-xs ${accent ? 'opacity-80' : 'text-gray-500'}`}>{label}</div>
      <div className="text-lg font-semibold tabular-nums">{valeur}</div>
    </div>
  )
}
