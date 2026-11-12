'use client'
// Prix public avec remise Black Week : ~~prix de départ~~ prix client + badge noir.
// Hors période (et sans ?apercu=blackweek), affiche le prix normal.
import { formatPrix } from '@/lib/formatPrix'
import { BLACK_WEEK_2026, remiseAffichee, prixClient } from '@/lib/remiseOperation'

const fmt = (n: number) => formatPrix(n, { decimals: Number.isInteger(n) ? 0 : 2 })

export default function PrixBlackWeek({ prix, remiseBlackWeek }: { prix: number; remiseBlackWeek?: number }) {
  const pct = remiseAffichee(BLACK_WEEK_2026, remiseBlackWeek)
  if (!pct) return <>{formatPrix(prix)} €</>
  return (
    <>
      <span style={{ textDecoration: 'line-through', color: '#999', marginRight: 6 }}>{fmt(prix)} €</span>
      <span style={{ fontWeight: 600 }}>{fmt(prixClient(prix, pct))} €</span>
      <span style={{ display: 'inline-block', marginLeft: 6, background: '#000', color: '#fff', fontSize: '0.8em', fontWeight: 700, letterSpacing: '0.05em', padding: '1px 6px' }}>BLACK WEEK -{pct} %</span>
    </>
  )
}
