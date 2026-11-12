'use client'
// Prix public avec remise Black Week : badge BLACK WEEK au-dessus, puis
// ~~prix de départ~~ prix client. Hors période (et sans ?apercu=blackweek),
// affiche le prix normal.
import { useEffect, useState } from 'react'
import { formatPrix } from '@/lib/formatPrix'
import { OPERATION_EN_COURS, remiseAffichee, prixClient, libelleMaj, finOperationMs } from '@/lib/remiseOperation'

const fmt = (n: number) => formatPrix(n, { decimals: Number.isInteger(n) ? 0 : 2 })

// Fin de l'opération = dernier jour 23:59:59 heure de Paris.
const FIN_MS = finOperationMs(OPERATION_EN_COURS)

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
  const pct = remiseAffichee(OPERATION_EN_COURS, remiseBlackWeek)
  if (!pct) return <>{formatPrix(prix)} €</>
  return (
    <>
      {badge && <span style={{ display: 'table', margin: '0 auto 4px', background: '#000', color: '#fff', fontSize: '1.15em', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 8px' }}>{libelleMaj(OPERATION_EN_COURS)} -{pct} %<Decompte /></span>}
      <span style={{ textDecoration: 'line-through', fontWeight: 600, marginRight: 6 }}>{fmt(prix)} €</span>
      <span>{fmt(prixClient(prix, pct))} €</span>
    </>
  )
}

/** Badge BLACK WEEK posé sur l'image (le parent doit être `relative`). */
export function BadgeBlackWeek({ remiseBlackWeek, taille = 13, avecPct = false }: { remiseBlackWeek?: number; taille?: number; avecPct?: boolean }) {
  const pct = remiseAffichee(OPERATION_EN_COURS, remiseBlackWeek)
  if (!pct) return null
  return (
    <span style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', zIndex: 10, background: '#000', color: '#fff', fontSize: taille, fontWeight: 700, letterSpacing: '0.08em', padding: `${Math.round(taille / 4)}px ${Math.round(taille * 0.6)}px`, fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      {libelleMaj(OPERATION_EN_COURS)}{avecPct ? ` ${pct}%` : ''}
    </span>
  )
}

/** Compte à rebours « 17j 06h 42min 08s » jusqu'à la fin, rafraîchi chaque seconde. */
function CompteARebours() {
  const [txt, setTxt] = useState('')
  useEffect(() => {
    const p2 = (n: number) => String(n).padStart(2, '0')
    const maj = () => {
      const ms = FIN_MS - Date.now()
      if (ms <= 0) { setTxt(''); return }
      const t = Math.floor(ms / 1000)
      const j = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60
      setTxt(`${p2(j)}j ${p2(h)}h ${p2(m)}min ${p2(sec)}s`)
    }
    maj()
    const id = setInterval(maj, 1000)
    return () => clearInterval(id)
  }, [])
  if (!txt) return null
  return <span style={{ marginLeft: 8, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{txt}</span>
}

/** Fiche produit — rendu validé, FIGÉ (version du commit fbcbc535) :
 *  prix barré gris, prix client en gras, puis badge « BLACK WEEK -X % ».
 *  Ne pas modifier avec la grille. */
export function PrixBlackWeekFiche({ prix, remiseBlackWeek }: { prix: number; remiseBlackWeek?: number }) {
  const pct = remiseAffichee(OPERATION_EN_COURS, remiseBlackWeek)
  if (!pct) return <>{formatPrix(prix)} €</>
  return (
    <>
      <span style={{ textDecoration: 'line-through', color: '#999', marginRight: 6 }}>{fmt(prix)} €</span>
      <span style={{ fontWeight: 600 }}>{fmt(prixClient(prix, pct))} €</span>
      <span style={{ display: 'inline-block', marginLeft: 6, background: '#000', color: '#fff', fontSize: '0.8em', fontWeight: 700, letterSpacing: '0.05em', padding: '1px 6px' }}>{libelleMaj(OPERATION_EN_COURS)} -{pct} %</span>
      <CompteARebours />
    </>
  )
}

/** Grille /boutique, sous le titre : « BLACK WEEK -X % » + prix barré + nouveau prix. */
export function PrixBlackWeekGrille({ prix, remiseBlackWeek }: { prix: number; remiseBlackWeek?: number }) {
  const pct = remiseAffichee(OPERATION_EN_COURS, remiseBlackWeek)
  if (!pct) return <>{formatPrix(prix)} €</>
  return (
    <>
      <span style={{ display: 'inline-block', marginRight: 6, background: '#000', color: '#fff', fontSize: '0.8em', fontWeight: 700, letterSpacing: '0.05em', padding: '1px 6px' }}>{libelleMaj(OPERATION_EN_COURS)}</span>
      <span style={{ textDecoration: 'line-through', fontWeight: 700, marginRight: 6 }}>{fmt(prix)} €</span>
      <span>{fmt(prixClient(prix, pct))} €</span>
    </>
  )
}
