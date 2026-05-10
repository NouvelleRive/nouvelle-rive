'use client'

import { useEffect, useRef, useState, CSSProperties } from 'react'

type Props = {
  src: string
  className?: string
  style?: CSSProperties
  controls?: boolean
}

/**
 * Vidéo qui ne se charge et ne se lance qu'une fois visible (Intersection Observer).
 * Avantage mobile : les vidéos hors écran ne plombent pas le chargement initial.
 */
export default function LazyAutoplayVideo({ src, className, style, controls = true }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          setShouldLoad(true)
          el.play().catch(() => {})
        } else {
          el.pause()
        }
      })
    }, { threshold: 0.25, rootMargin: '200px' })

    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <video
      ref={ref}
      src={shouldLoad ? src : undefined}
      data-src={src}
      className={className}
      style={style}
      autoPlay
      muted
      loop
      playsInline
      controls={controls}
      preload="metadata"
    />
  )
}
