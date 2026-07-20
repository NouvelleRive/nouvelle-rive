'use client'

import Link from 'next/link'
import { getCloudinaryUrl } from '@/lib/cloudinary'

export type MarqueeItem = {
  /** clé React (id produit / iconique). */
  key: string
  src: string
  alt: string
  /** Lien interne si la tuile navigue. Sans href, onClick rend un <button>. */
  href?: string
  onClick?: () => void
}

type Props = {
  items: MarqueeItem[]
  /**
   * Hauteur de la bande en mode autonome (ex: 'clamp(180px, 26vw, 320px)').
   * Omis = la bande remplit son parent (mode fond derrière un titre, cf. IconiquesView).
   */
  height?: string
  className?: string
  style?: React.CSSProperties
  /** Fade-in + glissement à l'apparition. */
  intro?: boolean
}

/**
 * Bandeau d'images infini (marquee CSS, pas de JS par frame).
 * Duplication ×2 de la liste + translateX(-50%) pour une boucle sans couture.
 * Utilisé par les pages Iconiques (fond du hero) et les pages créatrice (sous le titre).
 */
export default function InfiniteImageMarquee({ items, height, className, style, intro = true }: Props) {
  if (items.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes nr-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes nr-marquee-intro {
          0%   { opacity: 0; transform: translateX(40px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .nr-marquee-track {
          display: flex;
          width: max-content;
          height: 100%;
          animation: nr-marquee 45s linear infinite;
          will-change: transform;
        }
        .nr-marquee-intro {
          opacity: 0;
          animation: nr-marquee-intro 1s cubic-bezier(0.22, 1, 0.36, 1) 0.6s forwards;
          will-change: opacity, transform;
        }
        .nr-marquee-item {
          height: 100%;
          width: auto;
          background: #fff;
        }
        .nr-marquee-item img {
          height: 100%;
          width: auto;
          display: block;
        }
        @media (min-width: 768px) {
          .nr-marquee-track { animation-duration: 60s; }
        }
      `}</style>
      <div
        className={`overflow-hidden ${intro ? 'nr-marquee-intro ' : ''}${className || ''}`}
        style={{ height, ...style }}
      >
        <div className="nr-marquee-track">
          {[...items, ...items].map((it, i) => {
            const img = (
              <img
                src={getCloudinaryUrl(it.src, 600)}
                alt={it.alt}
                className="transition duration-500 group-hover:scale-105"
                loading={i < 6 ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={i < 4 ? 'high' : 'low'}
              />
            )
            const cls = 'nr-marquee-item shrink-0 relative group overflow-hidden bg-white'

            if (it.href) {
              return (
                <Link key={`${it.key}-${i}`} href={it.href} onClick={it.onClick} className={cls} aria-label={it.alt}>
                  {img}
                </Link>
              )
            }
            if (it.onClick) {
              return (
                <button key={`${it.key}-${i}`} onClick={it.onClick} className={cls} aria-label={it.alt}>
                  {img}
                </button>
              )
            }
            return (
              <div key={`${it.key}-${i}`} className={cls}>
                {img}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
