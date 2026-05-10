'use client'

import { useEffect, useRef, CSSProperties } from 'react'

type Props = {
  src: string
  className?: string
  style?: CSSProperties
  controls?: boolean
}

/**
 * Vidéo autoplay mobile-friendly :
 * - src + autoplay + muted + playsInline + preload="auto" dès le mount
 * - Force .play() à plusieurs hooks (onLoadedMetadata, onCanPlay) car iOS
 *   Safari ignore parfois l'attribut autoplay seul
 * - Pause/play au scroll via Intersection Observer (économise CPU)
 */
export default function LazyAutoplayVideo({ src, className, style, controls = false }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const tryPlay = () => {
      const promise = el.play()
      if (promise && typeof promise.catch === 'function') promise.catch(() => {})
    }

    // Sécurité : tente play à intervalles réguliers la 1ère seconde
    tryPlay()
    const t1 = setTimeout(tryPlay, 100)
    const t2 = setTimeout(tryPlay, 500)
    const t3 = setTimeout(tryPlay, 1000)

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) tryPlay()
        else el.pause()
      })
    }, { threshold: 0.1, rootMargin: '100px' })

    obs.observe(el)
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
      obs.disconnect()
    }
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
      onLoadedMetadata={(e) => {
        const v = e.currentTarget
        v.muted = true
        const p = v.play()
        if (p && typeof p.catch === 'function') p.catch(() => {})
      }}
      onCanPlay={(e) => {
        const v = e.currentTarget
        v.muted = true
        const p = v.play()
        if (p && typeof p.catch === 'function') p.catch(() => {})
      }}
    />
  )
}
