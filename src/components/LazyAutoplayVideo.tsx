'use client'

import { useEffect, useRef, useState, CSSProperties } from 'react'

type Props = {
  src: string
  className?: string
  style?: CSSProperties
  controls?: boolean
}

/**
 * Vidéo autoplay mobile-friendly avec fallback tap :
 * - autoplay + muted + playsInline + preload="auto" → marche dans 95% des cas
 * - Intersection Observer : pause hors écran (économise CPU)
 * - Si autoplay échoue (mode éco iOS, navigateur strict) : un overlay tap
 *   apparaît, et au clic on lance .play() manuellement.
 */
export default function LazyAutoplayVideo({ src, className, style, controls = false }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [needsTap, setNeedsTap] = useState(false)

  const tryPlay = () => {
    const el = ref.current
    if (!el) return
    el.muted = true
    const p = el.play()
    if (p && typeof p.catch === 'function') {
      p.then(() => setNeedsTap(false)).catch(() => setNeedsTap(true))
    }
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return

    tryPlay()

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) tryPlay()
        else el.pause()
      })
    }, { threshold: 0.01, rootMargin: '600px' })

    obs.observe(el)
    return () => obs.disconnect()
  }, [src])

  const handleTap = () => {
    const el = ref.current
    if (!el) return
    el.muted = true
    el.play().then(() => setNeedsTap(false)).catch(() => {})
  }

  return (
    <div className={className} style={{ position: 'relative', ...style }} onClick={handleTap}>
      <video
        ref={ref}
        src={src}
        className="w-full h-full object-cover"
        autoPlay
        muted
        defaultMuted
        loop
        playsInline
        controls={controls}
        preload="auto"
        onCanPlay={tryPlay}
        onPlay={() => setNeedsTap(false)}
      />
      {needsTap && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.2)' }}
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="white" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}>
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
    </div>
  )
}
