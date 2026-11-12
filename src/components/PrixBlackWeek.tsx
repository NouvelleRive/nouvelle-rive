'use client'
// Prix public avec remise Black Week : badge BLACK WEEK au-dessus, puis
// ~~prix de départ~~ prix client. Hors période (et sans ?apercu=blackweek),
// affiche le prix normal.
import { formatPrix } from '@/lib/formatPrix'
import { BLACK_WEEK_2026, remiseAffichee, prixClient } from '@/lib/remiseOperation'

const fmt = (n: number) => formatPrix(n, { decimals: Number.isInteger(n) ? 0 : 2 })

export default function PrixBlackWeek({ prix, remiseBlackWeek, badge = false }: { prix: number; remiseBlackWeek?: number; badge?: boolean }) {
  const pct = remiseAffichee(BLACK_WEEK_2026, remiseBlackWeek)
  if (!pct) return <>{formatPrix(prix)} €</>
  return (
    <>
      {badge && <span style={{ display: 'table', margin: '0 auto 4px', background: '#000', color: '#fff', fontSize: '1.15em', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 8px' }}>BLACK WEEK -{pct} %</span>}
      <span style={{ textDecoration: 'line-through', color: '#999', marginRight: 6 }}>{fmt(prix)} €</span>
      <span style={{ fontWeight: 600 }}>{fmt(prixClient(prix, pct))} €</span>
    </>
  )
}

/** Badge BLACK WEEK posé sur l'image (le parent doit être `relative`). */
export function BadgeBlackWeek({ remiseBlackWeek }: { remiseBlackWeek?: number }) {
  const pct = remiseAffichee(BLACK_WEEK_2026, remiseBlackWeek)
  if (!pct) return null
  return (
    <span style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, background: '#000', color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', padding: '3px 8px', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      BLACK WEEK -{pct} %
    </span>
  )
}
