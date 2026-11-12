'use client'
// Prix public avec remise Black Week : badge BLACK WEEK au-dessus, puis
// ~~prix de départ~~ prix client. Hors période (et sans ?apercu=blackweek),
// affiche le prix normal.
import { formatPrix } from '@/lib/formatPrix'
import { BLACK_WEEK_2026, remiseAffichee, prixClient } from '@/lib/remiseOperation'

const fmt = (n: number) => formatPrix(n, { decimals: Number.isInteger(n) ? 0 : 2 })

export default function PrixBlackWeek({ prix, remiseBlackWeek }: { prix: number; remiseBlackWeek?: number }) {
  const pct = remiseAffichee(BLACK_WEEK_2026, remiseBlackWeek)
  if (!pct) return <>{formatPrix(prix)} €</>
  return (
    <>
      <span style={{ display: 'table', margin: '0 auto 4px', background: '#000', color: '#fff', fontSize: '1.15em', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 8px' }}>BLACK WEEK -{pct} %</span>
      <span style={{ textDecoration: 'line-through', color: '#999', marginRight: 6 }}>{fmt(prix)} €</span>
      <span style={{ fontWeight: 600 }}>{fmt(prixClient(prix, pct))} €</span>
    </>
  )
}
