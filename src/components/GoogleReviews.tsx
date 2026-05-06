'use client'

import { useEffect, useState } from 'react'

const bleuElectrique = '#0000FF'

type Review = {
  author: string
  authorPhoto: string | null
  rating: number
  text: string
  relativeTime: string
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

  useEffect(() => {
    fetch('/api/google-reviews')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(e => setError(e.message))
  }, [])

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
    <section className="px-6 lg:px-12 py-16" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      {/* En-tête */}
      <div className="flex items-baseline justify-between flex-wrap gap-4 mb-12">
        <h2
          className="uppercase"
          style={{
            fontSize: 'clamp(28px, 4vw, 48px)',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            lineHeight: '1',
          }}
        >
          Avis Google
          {data.preview && (
            <span style={{ fontSize: '11px', letterSpacing: '0.2em', color: '#999', fontWeight: '400', marginLeft: '12px' }}>
              (PREVIEW — clé API manquante)
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3" style={{ fontSize: '14px' }}>
          <Stars rating={data.rating} />
          <span style={{ fontWeight: '600' }}>{data.rating.toFixed(1)}</span>
          <span style={{ color: '#666' }}>· {data.total} avis</span>
        </div>
      </div>

      {/* Grille avis */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px" style={{ backgroundColor: '#000', border: '1px solid #000' }}>
        {data.reviews.map((r, i) => (
          <article
            key={i}
            className="p-6 lg:p-8 bg-white flex flex-col gap-4"
            style={{ minHeight: '220px' }}
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
                WebkitLineClamp: 8,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {r.text}
            </p>
          </article>
        ))}
      </div>

      {/* Lien voir tous */}
      {data.mapsUri && (
        <div className="mt-8 text-center">
          <a
            href={data.mapsUri}
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
      )}
    </section>
  )
}
