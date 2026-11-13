'use client'
// Page admin « Opérations » : suivi de l'opération de remise en cours
// (lib/remiseOperation). Données = caches produits/chineuses (0 lecture Firestore).
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
          fetch('/api/admin/produits-full', { headers, cache: 'no-store' }),
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
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Détail par remise</h3>
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
