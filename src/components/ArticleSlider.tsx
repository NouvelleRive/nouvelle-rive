'use client'

import { useEffect, useState } from 'react'

const bleu = '#0000FF'

export default function ArticleSlider({ images }: { images: { src: string; alt: string }[] }) {
  const [i, setI] = useState(0)
  const n = images.length

  useEffect(() => {
    if (n < 2) return
    const id = setInterval(() => setI(v => (v + 1) % n), 3500)
    return () => clearInterval(id)
  }, [n])

  if (n === 0) return null

  return (
    <figure className="my-8">
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: 4, background: '#f5f5f5' }}>
        {images.map((img, idx) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={idx}
            src={img.src}
            alt={img.alt}
            loading="lazy"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: idx === i ? 1 : 0,
              transition: 'opacity 0.6s ease',
            }}
          />
        ))}
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {images.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            aria-label={`Image ${idx + 1}`}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              background: idx === i ? bleu : '#d0d0d0',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>
      {images[i]?.alt && (
        <figcaption className="mt-1 text-center" style={{ fontSize: '12px', color: '#999' }}>{images[i].alt}</figcaption>
      )}
    </figure>
  )
}
