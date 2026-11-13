'use client'
// Page admin « Opérations » : suivi de l'opération de remise en cours
// (lib/remiseOperation). Pièces remisées lues en direct (/api/admin/operations).
import { useEffect, useMemo, useState } from 'react'
import { auth } from '@/lib/firebaseConfig'
import { OPERATION_EN_COURS, statsOperation, periodeCourte, type ProduitOperation } from '@/lib/remiseOperation'

export default function OperationsPage() {
  const [produits, setProduits] = useState<ProduitOperation[]>([])
  const [noms, setNoms] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const token = await auth.currentUser?.getIdToken()
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined
        const [pRes, cRes] = await Promise.all([
          fetch('/api/admin/operations', { headers, cache: 'no-store' }),
          fetch('/api/admin/chineuses-full', { headers }),
        ])
        const p = pRes.ok ? await pRes.json() : { produits: [] }
        const c = cRes.ok ? await cRes.json() : { chineuses: [] }
        setProduits(Array.isArray(p.produits) ? p.produits : [])
        setNoms(Object.fromEntries((c.chineuses || []).map((ch: any) => [String(ch.trigramme || '').toUpperCase(), ch.nom || ch.trigramme])))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const stats = useMemo(() => statsOperation(produits), [produits])
  const pcts = Object.keys(stats.parPct).map(Number).sort((a, b) => a - b)
  const [survol, setSurvol] = useState<number | null>(null)

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Opérations</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-bold tracking-wide">{OPERATION_EN_COURS.label.toUpperCase()}</h2>
          <span className="text-sm text-gray-500">{periodeCourte(OPERATION_EN_COURS)}</span>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm">Chargement…</p>
        ) : (
          <>
            <div className="flex gap-4 flex-wrap">
              <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-2xl font-semibold">{stats.parChineuse.length}</div>
                <div className="text-xs text-gray-500">chineuses participantes</div>
              </div>
              <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-2xl font-semibold">{stats.nbPieces}</div>
                <div className="text-xs text-gray-500">pièces en réduction</div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Répartition des pièces par remise</h3>
              {pcts.length > 0 && (() => {
                // Camembert (anneau) : une part par % présent, teinte unique claire → foncée
                // selon le % (magnitude), 2px de blanc entre les parts.
                const total = stats.nbPieces
                const R = 70, r = 42, C = 80
                const teinte = (i: number) => {
                  const t = pcts.length === 1 ? 1 : i / (pcts.length - 1)
                  const mix = (a: number, b: number) => Math.round(a + (b - a) * t)
                  return `rgb(${mix(184, 18)}, ${mix(183, 17)}, ${mix(236, 110)})`
                }
                let angle = -Math.PI / 2
                const parts = pcts.map((p, i) => {
                  const n = stats.parPct[p]
                  const a0 = angle, a1 = angle + (n / total) * 2 * Math.PI
                  angle = a1
                  const large = a1 - a0 > Math.PI ? 1 : 0
                  const pt = (rad: number, ang: number) => `${C + rad * Math.cos(ang)} ${C + rad * Math.sin(ang)}`
                  const d = n === total
                    ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} L ${C - 0.01} ${C - r} A ${r} ${r} 0 1 0 ${C} ${C - r} Z`
                    : `M ${pt(R, a0)} A ${R} ${R} 0 ${large} 1 ${pt(R, a1)} L ${pt(r, a1)} A ${r} ${r} 0 ${large} 0 ${pt(r, a0)} Z`
                  return { p, n, d, couleur: teinte(i) }
                })
                const actif = survol !== null ? parts.find(x => x.p === survol) : null
                return (
                  <div className="flex items-center gap-8 flex-wrap mb-4">
                    <svg viewBox="0 0 160 160" width="180" height="180" role="img" aria-label="Répartition des pièces par pourcentage de remise">
                      {parts.map(x => (
                        <path key={x.p} d={x.d} fill={x.couleur} stroke="#fff" strokeWidth={2}
                          opacity={survol === null || survol === x.p ? 1 : 0.45}
                          onMouseEnter={() => setSurvol(x.p)} onMouseLeave={() => setSurvol(null)}>
                          <title>{`-${x.p} % : ${x.n} pièce${x.n > 1 ? 's' : ''}`}</title>
                        </path>
                      ))}
                      <text x={C} y={C - 2} textAnchor="middle" fontSize="20" fontWeight="600" fill="#111">{actif ? actif.n : total}</text>
                      <text x={C} y={C + 14} textAnchor="middle" fontSize="9" fill="#6b7280">{actif ? `à -${actif.p} %` : 'pièces'}</text>
                    </svg>
                    <ul className="space-y-1 text-sm">
                      {parts.map(x => (
                        <li key={x.p} className="flex items-center gap-2" onMouseEnter={() => setSurvol(x.p)} onMouseLeave={() => setSurvol(null)}>
                          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: x.couleur }} />
                          <span className="font-medium text-gray-800 w-12">-{x.p} %</span>
                          <span className="text-gray-500">{x.n} pièce{x.n > 1 ? 's' : ''} · {Math.round((x.n / total) * 100)} %</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })()}
              {pcts.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune pièce en réduction pour l&apos;instant.</p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {pcts.map(p => (
                    <div key={p} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                      <span className="font-semibold">-{p} %</span>
                      <span className="text-gray-500 ml-2">{stats.parPct[p]} pièce{stats.parPct[p] > 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {stats.parChineuse.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Chineuses participantes</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {stats.parChineuse.map(c => (
                      <tr key={c.trigramme} className="border-t border-gray-100">
                        <td className="py-2 font-medium">{(noms[c.trigramme] || c.trigramme).toUpperCase()}</td>
                        <td className="py-2 text-gray-500">
                          {Object.keys(c.parPct).map(Number).sort((a, b) => a - b).map(p => `-${p} % × ${c.parPct[p]}`).join(' · ')}
                        </td>
                        <td className="py-2 text-right font-semibold">{c.nbPieces} pièce{c.nbPieces > 1 ? 's' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
