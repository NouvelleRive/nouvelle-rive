// app/api/reseaux/video/route.ts
// Proxy vidéo : sert une vidéo Firebase/Bunny depuis nouvellerive.eu.
// Sert à la capture de vignette côté client : en même origine, le canvas n'est
// jamais « tainted » et aucun en-tête CORS n'est nécessaire (le lecteur iOS
// échouait avec crossOrigin="anonymous" → « vidéo illisible (CORS ?) »).
// Les requêtes Range sont relayées telles quelles pour que le seek fonctionne.

export const runtime = 'nodejs'

import { NextRequest } from 'next/server'

const ALLOWED = ['b-cdn.net', 'firebasestorage.googleapis.com']

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') || ''
  if (!url || !ALLOWED.some((h) => url.includes(h))) {
    return new Response('bad url', { status: 400 })
  }
  try {
    const range = req.headers.get('range')
    const r = await fetch(url, { headers: range ? { Range: range } : undefined })
    if (!r.ok && r.status !== 206) return new Response('not found', { status: 404 })

    const headers = new Headers({
      'Content-Type': r.headers.get('content-type') || 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    })
    for (const h of ['content-length', 'content-range']) {
      const v = r.headers.get(h)
      if (v) headers.set(h, v)
    }
    return new Response(r.body, { status: r.status, headers })
  } catch {
    return new Response('error', { status: 500 })
  }
}
