'use client'

import { useEffect, useRef, useState } from 'react'

const bleuElectrique = '#0000FF'

type Review = {
  author: string
  authorPhoto: string | null
  rating: number
  text: string
  relativeTime: string
  reply?: { text: string; relativeTime: string } | null
}

type Data = {
  name: string
  rating: number
  total: number
  mapsUri: string | null
  reviews: Review[]
  preview?: boolean
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating)
  return (
    <span aria-label={`${rating} sur 5`} style={{ color: bleuElectrique, letterSpacing: '0.1em' }}>
      {'★'.repeat(full)}
      <span style={{ color: '#ddd' }}>{'★'.repeat(5 - full)}</span>
    </span>
  )
}

export default function GoogleReviews() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/google-reviews')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(e => setError(e.message))
  }, [])

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    const card = el.querySelector('article')
    const step = card ? card.clientWidth + 16 : el.clientWidth * 0.8
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  if (error) return null
  if (!data) {
    return (
      <div className="px-6 py-12 text-center" style={{ fontSize: '11px', color: '#999', letterSpacing: '0.2em' }}>
        CHARGEMENT DES AVIS…
      </div>
    )
  }

  if (data.reviews.length === 0) return null

  return (
    <section className="py-16" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      {/* En-tête */}
      <div className="px-6 lg:px-12 flex items-baseline justify-between flex-wrap gap-4 mb-10">
        <h2
          className="uppercase"
          style={{
            fontSize: 'clamp(28px, 4vw, 48px)',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            lineHeight: '1',
          }}
        >
          Vos avis
          {data.preview && (
            <span style={{ fontSize: '11px', letterSpacing: '0.2em', color: '#999', fontWeight: '400', marginLeft: '12px' }}>
              (PREVIEW)
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3" style={{ fontSize: '14px' }}>
          <Stars rating={data.rating} />
          <span style={{ fontWeight: '600' }}>{data.rating.toFixed(1)}</span>
          <span style={{ color: '#666' }}>· {data.total} avis</span>
        </div>
      </div>

      {/* Carrousel */}
      <div className="relative">
        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto px-6 lg:px-12 pb-4"
          style={{
            scrollSnapType: 'x mandatory',
            scrollBehavior: 'smooth',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <style jsx>{`
            div::-webkit-scrollbar { display: none; }
          `}</style>
          {data.reviews.map((r, i) => (
            <article
              key={i}
              className="flex-shrink-0 flex flex-col gap-4 p-6"
              style={{
                width: 'min(85vw, 360px)',
                scrollSnapAlign: 'start',
                border: '1px solid #000',
                backgroundColor: '#fff',
              }}
            >
              <div className="flex items-center gap-3">
                {r.authorPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.authorPhoto}
                    alt={r.author}
                    width={36}
                    height={36}
                    referrerPolicy="no-referrer"
                    style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: bleuElectrique,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: '600',
                    }}
                  >
                    {r.author.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col">
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>{r.author}</span>
                  <span style={{ fontSize: '11px', color: '#666' }}>{r.relativeTime}</span>
                </div>
              </div>
              <Stars rating={r.rating} />
              <p
                style={{
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: '#222',
                  display: '-webkit-box',
                  WebkitLineClamp: 6,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {r.text}
              </p>

              {r.reply && (
                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: 12,
                    borderTop: '1px solid #eee',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      style={{
                        fontSize: '10px',
                        letterSpacing: '0.15em',
                        fontWeight: 700,
                        color: bleuElectrique,
                      }}
                    >
                      RÉPONSE NOUVELLE RIVE
                    </span>
                    <span style={{ fontSize: '10px', color: '#999' }}>· {r.reply.relativeTime}</span>
                  </div>
                  <p
                    style={{
                      fontSize: '12px',
                      lineHeight: '1.5',
                      color: '#444',
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {r.reply.text}
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>

        {/* Flèches navigation (desktop only) */}
        <button
          aria-label="Précédent"
          onClick={() => scrollBy(-1)}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 items-center justify-center transition-opacity hover:opacity-60"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: '#fff',
            border: '1px solid #000',
            zIndex: 5,
          }}
        >
          <span style={{ fontSize: '18px', lineHeight: 1 }}>←</span>
        </button>
        <button
          aria-label="Suivant"
          onClick={() => scrollBy(1)}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 items-center justify-center transition-opacity hover:opacity-60"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: '#fff',
            border: '1px solid #000',
            zIndex: 5,
          }}
        >
          <span style={{ fontSize: '18px', lineHeight: 1 }}>→</span>
        </button>
      </div>

      {/* Lien voir tous — pointe directement sur l'onglet avis Google */}
      <div className="mt-8 text-center px-6 lg:px-12">
        <a
          href="https://www.google.com/maps?cid=13450927928425031822"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block py-3 px-6 transition-opacity hover:opacity-60"
          style={{
            fontSize: '11px',
            letterSpacing: '0.2em',
            fontWeight: '600',
            color: bleuElectrique,
            borderBottom: `1px solid ${bleuElectrique}`,
          }}
        >
          VOIR TOUS LES AVIS SUR GOOGLE
        </a>
      </div>
    </section>
  )
}
