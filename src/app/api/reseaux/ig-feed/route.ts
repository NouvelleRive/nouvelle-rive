import { NextResponse } from 'next/server'

// Récupère les vrais posts publiés du compte Instagram (feed profil).
// Sert à la « preview » du feed dans /vendeuse/reseaux (onglet Feed).
// Mis en cache 30 min pour éviter de spammer l'API Graph.

const IG_BUSINESS_ID = process.env.IG_BUSINESS_ACCOUNT_ID
const IG_TOKEN = process.env.IG_PAGE_ACCESS_TOKEN
const API_VERSION = 'v25.0'

type IgMedia = {
  id: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_product_type?: 'FEED' | 'REELS' | 'STORY' | 'AD'
  media_url?: string
  thumbnail_url?: string
  permalink: string
  timestamp: string
}

export async function GET() {
  if (!IG_BUSINESS_ID || !IG_TOKEN) {
    return NextResponse.json({ success: false, error: 'IG non configuré' }, { status: 500 })
  }

  try {
    const fields = 'id,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp'
    const url = `https://graph.facebook.com/${API_VERSION}/${IG_BUSINESS_ID}/media?fields=${fields}&limit=40&access_token=${IG_TOKEN}`
    const res = await fetch(url, { next: { revalidate: 1800 } })
    const data = await res.json()

    if (!res.ok || data.error) {
      return NextResponse.json(
        { success: false, error: data.error?.message || `Graph ${res.status}` },
        { status: 502 },
      )
    }

    const posts = (data.data as IgMedia[])
      // Stories exclues ; reels gardés (l'API n'indique pas ceux masqués de la
      // grille → masquage manuel côté app via /api/reseaux/feed-hidden).
      .filter((m) => m.media_product_type !== 'STORY')
      .slice(0, 40)
      .map((m) => ({
        id: m.id,
        imageUrl: m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url,
        permalink: m.permalink,
        isVideo: m.media_type === 'VIDEO',
        isReel: m.media_product_type === 'REELS',
        isAlbum: m.media_type === 'CAROUSEL_ALBUM',
      }))

    return NextResponse.json(
      { success: true, posts },
      { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' } },
    )
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
