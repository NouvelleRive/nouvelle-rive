// app/api/reseaux/img/route.ts
// Proxy image : sert une image Bunny/Firebase depuis le domaine nouvellerive.eu
// (vérifié TikTok) → nécessaire pour poster un carrousel PHOTO en pull_from_url.

export const runtime = 'nodejs'

import { NextRequest } from 'next/server'

const ALLOWED = ['b-cdn.net', 'firebasestorage.googleapis.com']

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') || ''
  if (!url || !ALLOWED.some((h) => url.includes(h))) {
    return new Response('bad url', { status: 400 })
  }
  try {
    const r = await fetch(url)
    if (!r.ok) return new Response('not found', { status: 404 })
    const buf = Buffer.from(await r.arrayBuffer())
    return new Response(buf, {
      headers: {
        'Content-Type': r.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new Response('error', { status: 500 })
  }
}
