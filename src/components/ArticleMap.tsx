'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

type Marker = { name: string; kind: string; lat: number; lng: number }

const COLORS: Record<string, string> = {
  fripe: '#0000FF',
  lieu: '#e11d48',
  food: '#f59e0b',
  cafe: '#16a34a',
}

export default function ArticleMap({ markers }: { markers?: Marker[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || !markers?.length) return
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !ref.current) return
      map = L.map(ref.current, { scrollWheelZoom: false })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)
      const pts: [number, number][] = []
      markers.forEach((m) => {
        const color = COLORS[m.kind] || '#0000FF'
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })
        L.marker([m.lat, m.lng], { icon }).addTo(map).bindPopup(m.name)
        pts.push([m.lat, m.lng])
      })
      map.fitBounds(pts, { padding: [30, 30], maxZoom: 16 })
    })()
    return () => {
      cancelled = true
      if (map) map.remove()
    }
  }, [markers])

  if (!markers?.length) return null

  return (
    <div className="my-8">
      <div ref={ref} style={{ width: '100%', height: 440, borderRadius: 4, border: '1px solid #000', position: 'relative', zIndex: 0 }} />
      <div className="flex flex-wrap gap-4 mt-2" style={{ fontSize: 11, color: '#666' }}>
        <span>🔵 Fripes</span>
        <span>🔴 À voir</span>
        <span>🟠 Déjeuner</span>
        <span>🟢 Café</span>
      </div>
    </div>
  )
}
