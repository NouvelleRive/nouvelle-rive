// app/api/reseaux/tiktok-feed/route.ts
// Récupère les vraies vidéos du compte TikTok (Display API, scope video.list)
// pour l'aperçu Feed → onglet TikTok. Renvoie couverture + lien.

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getTikTokToken } from '@/lib/tiktokPublish'

export async function GET() {
  try {
    const token = await getTikTokToken()
    const res = await fetch('https://open.tiktokapis.com/v2/video/list/?fields=id,cover_image_url,share_url,title', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_count: 20 }),
    })
    const data = await res.json()
    if (data?.error && data.error.code !== 'ok') {
      return NextResponse.json({ success: false, error: data.error.message || data.error.code }, { status: 502 })
    }
    const posts = (data?.data?.videos || []).map((v: any) => ({
      id: v.id,
      imageUrl: v.cover_image_url,
      permalink: v.share_url,
      isVideo: true,
    }))
    return NextResponse.json(
      { success: true, posts },
      { headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1800' } },
    )
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
