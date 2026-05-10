'use client'

import { useEffect, useRef, useState, CSSProperties } from 'react'

type Props = {
  src: string
  className?: string
  style?: CSSProperties
  controls?: boolean
}

/**
 * Vidéo autoplay économe en bande passante :
 * - preload="metadata" par défaut (~30KB par vidéo, léger même sur 4G)
 * - Quand la vidéo entre dans le viewport (Intersection Observer), on
 *   passe preload="auto" + .load() + .play() → la vidéo se télécharge
 *   et démarre.
 * - Hors viewport : pause + retour à preload léger.
 * - autoplay/muted/playsInline pour la compat iOS.
 */
export default function LazyAutoplayVideo({ src, className, style, controls = false }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          setActive(true)
          el.muted = true
          const p = el.play()
          if (p && typeof p.catch === 'function') p.catch(() => {})
        } else {
          el.pause()
        }
      })
    }, { threshold: 0.01, rootMargin: '600px' })

    obs.observe(el)
    return () => obs.disconnect()
  }, [src])

  return (
    <video
      ref={ref}
      src={src}
      className={className}
      style={style}
      autoPlay
      muted
      defaultMuted
      loop
      playsInline
      controls={controls}
      preload="auto"
      onCanPlay={(e) => {
        if (!active) return
        const v = e.currentTarget
        v.muted = true
        const p = v.play()
        if (p && typeof p.catch === 'function') p.catch(() => {})
      }}
    />
  )
}
