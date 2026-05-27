// ARCHIVE — Bouton "Synchroniser" admin (page Ventes)
//
// Retiré de SalesList.tsx + admin/nos-ventes/page.tsx. Le bouton
// déclenchait un appel à /api/sync-ventes pour réimporter les
// ventes Square sur une plage de dates (de la dernière vente
// jusqu'à aujourd'hui). On le sortait à la main quand on
// soupçonnait qu'une vente Square avait été ratée par le webhook.
//
// Pourquoi on le retire :
//   - le webhook Square (`payment.created`) est censé pousser les
//     ventes en temps réel, et la sync Square admin doublonne ce
//     flux pour rien la plupart du temps,
//   - l'eBay sync reste piloté côté serveur par le cron Firebase
//     `/api/sync/ebay-orders` (cf. memory project_ebay_sync.md),
//   - en pratique on ne le cliquait plus.
//
// Pour le réactiver un jour :
//   1. réinjecter `onSync` + `syncLoading` dans SalesListProps,
//   2. remettre `handleSync` côté page admin (cf. exemple ci-dessous),
//   3. importer ce bouton dans la barre du haut de SalesList.
//
// Note : le composant `SyncVentesButton` (src/components/SyncVentesButton.tsx)
// — utilisé côté chineuse pour récupérer ses propres ventes — n'est
// PAS concerné. C'est un autre flux, conservé tel quel.

'use client'

import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import type { Vente } from '@/components/SalesList'

type Props = {
  ventes: Vente[]
  syncLoading: boolean
  onSync: (startDate: string, endDate: string) => Promise<void>
}

function getDateFromVente(v: Vente): Date {
  if (v.dateVente && typeof (v.dateVente as any).toDate === 'function') {
    return (v.dateVente as any).toDate()
  }
  if (typeof v.dateVente === 'string') return new Date(v.dateVente)
  return new Date()
}

export default function SyncVentesAdminButton({ ventes, syncLoading, onSync }: Props) {
  const derniereVenteDate = useMemo(() => {
    if (ventes.length === 0) return null
    const dates = ventes.map(getDateFromVente).filter(d => !isNaN(d.getTime()))
    if (dates.length === 0) return null
    return new Date(Math.max(...dates.map(d => d.getTime())))
  }, [ventes])

  const handleSyncRecent = async () => {
    const startDate = derniereVenteDate
      ? format(derniereVenteDate, 'yyyy-MM-dd')
      : format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
    const endDate = format(new Date(), 'yyyy-MM-dd')
    await onSync(startDate, endDate)
  }

  return (
    <button
      onClick={handleSyncRecent}
      disabled={syncLoading}
      className="flex items-center gap-2 bg-[#22209C] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#1a1a7a] transition-colors"
    >
      <RefreshCw size={16} className={syncLoading ? 'animate-spin' : ''} />
      {syncLoading ? 'Sync...' : 'Synchroniser'}
    </button>
  )
}

// Exemple de handler côté page admin (à remettre si on réactive) :
//
// const [syncLoading, setSyncLoading] = useState(false)
//
// const handleSync = async (startDate: string, endDate: string) => {
//   setSyncLoading(true)
//   try {
//     const res = await fetch('/api/sync-ventes', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ startDate, endDate })
//     })
//     const data = await res.json()
//     if (data.success) {
//       alert(`${data.imported || 0} vente(s) synchronisée(s)`)
//       await loadVentes()
//     } else {
//       alert(data.error || 'Erreur sync')
//     }
//   } catch (e) {
//     alert('Erreur : SQ500')
//   } finally {
//     setSyncLoading(false)
//   }
// }
