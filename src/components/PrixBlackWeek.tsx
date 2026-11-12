'use client'
// Prix public avec remise Black Week : badge BLACK WEEK au-dessus, puis
// ~~prix de départ~~ prix client. Hors période (et sans ?apercu=blackweek),
// affiche le prix normal.
import { useEffect, useState } from 'react'
import { formatPrix } from '@/lib/formatPrix'
import { BLACK_WEEK_2026, remiseAffichee, prixClient } from '@/lib/remiseOperation'

const fmt = (n: number) => formatPrix(n, { decimals: Number.isInteger(n) ? 0 : 2 })

// Fin de l'opération = dernier jour 23:59:59 heure de Paris (novembre = UTC+1).
const FIN_MS = new Date(`${BLACK_WEEK_2026.fin}T23:59:59+01:00`).getTime()

/** « PLUS QUE 3J 4H 12MIN » — calculé côté client, rafraîchi chaque minute. */
function Decompte() {
  const [txt, setTxt] = useState('')
  useEffect(() => {
    const maj = () => {
      const ms = FIN_MS - Date.now()
      if (ms <= 0) { setTxt(''); return }
      const min = Math.floor(ms / 60000)
      const j = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60
      setTxt(`PLUS QUE ${j ? `${j}J ` : ''}${h}H ${m}MIN`)
    }
    maj()
    const id = setInterval(maj, 60000)
    return () => clearInterval(id)
  }, [])
  if (!txt) return null
  return <span style={{ marginLeft: 8, fontWeight: 400 }}>{txt}</span>
}

export default function PrixBlackWeek({ prix, remiseBlackWeek, badge = false }: { prix: number; remiseBlackWeek?: number; badge?: boolean }) {
  const pct = remiseAffichee(BLACK_WEEK_2026, remiseBlackWeek)
  if (!pct) return <>{formatPrix(prix)} €</>
  return (
    <>
      {badge && <span style={{ display: 'table', margin: '0 auto 4px', background: '#000', color: '#fff', fontSize: '1.15em', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 8px' }}>BLACK WEEK -{pct} %<Decompte /></span>}
      <span style={{ textDecoration: 'line-through', fontWeight: 600, marginRight: 6 }}>{fmt(prix)} €</span>
      <span>{fmt(prixClient(prix, pct))} €</span>
    </>
  )
}

/** Badge BLACK WEEK posé sur l'image (le parent doit être `relative`). */
export function BadgeBlackWeek({ remiseBlackWeek, taille = 13, avecPct = false }: { remiseBlackWeek?: number; taille?: number; avecPct?: boolean }) {
  const pct = remiseAffichee(BLACK_WEEK_2026, remiseBlackWeek)
  if (!pct) return null
  return (
    <span style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', zIndex: 10, background: '#000', color: '#fff', fontSize: taille, fontWeight: 700, letterSpacing: '0.08em', padding: `${Math.round(taille / 4)}px ${Math.round(taille * 0.6)}px`, fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      BLACK WEEK{avecPct ? ` ${pct}%` : ''}
    </span>
  )
}

/** Fiche produit — rendu validé, FIGÉ : badge « BLACK WEEK -X % » au-dessus,
 *  prix barré gris, prix client en gras. Ne pas modifier avec la grille. */
export function PrixBlackWeekFiche({ prix, remiseBlackWeek }: { prix: number; remiseBlackWeek?: number }) {
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

/** Grille /boutique, sous le titre : « BLACK WEEK -X % » + prix barré + nouveau prix. */
export function PrixBlackWeekGrille({ prix, remiseBlackWeek }: { prix: number; remiseBlackWeek?: number }) {
  const pct = remiseAffichee(BLACK_WEEK_2026, remiseBlackWeek)
  if (!pct) return <>{formatPrix(prix)} €</>
  return (
    <>
      <span style={{ display: 'inline-block', marginRight: 6, background: '#000', color: '#fff', fontSize: '0.8em', fontWeight: 700, letterSpacing: '0.05em', padding: '1px 6px' }}>BLACK WEEK</span>
      <span style={{ textDecoration: 'line-through', fontWeight: 700, marginRight: 6 }}>{fmt(prix)} €</span>
      <span>{fmt(prixClient(prix, pct))} €</span>
    </>
  )
}
