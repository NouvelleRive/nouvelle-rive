// app/api/tiktok/publish/route.ts
// Dépose la vidéo d'une prod en brouillon sur TikTok (Content Posting API).

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { publishTikTokDraft, publishTikTokPhotos } from '@/lib/tiktokPublish'

export async function POST(req: NextRequest) {
  try {
    const { chronique, date, videoUrl, imageUrls, caption } = await req.json()

    // Vidéo directe fournie → reel
    if (videoUrl) {
      const r = await publishTikTokDraft(videoUrl)
      return NextResponse.json({ success: true, ...r })
    }
    // Images fournies → carrousel photo
    if (Array.isArray(imageUrls) && imageUrls.length) {
      const r = await publishTikTokPhotos(imageUrls, caption || '')
      return NextResponse.json({ success: true, type: 'photo', ...r })
    }

    if (!chronique || !date) return NextResponse.json({ success: false, error: 'chronique/date requis' }, { status: 400 })
    const snap = await adminDb.collection('reseauxContenu').doc(`${chronique}_${date}`).get()
    const p = snap.exists ? (snap.data() as any) : null
    if (!p) return NextResponse.json({ success: false, error: 'introuvable' }, { status: 404 })
    const docCaption = p.caption || ''

    if (p.format === 'publi') {
      // Carrousel : photos → diaporama TikTok ; sinon 1re vidéo → reel
      const images = (Array.isArray(p.medias) ? p.medias : []).filter((m: any) => m.type === 'image').map((m: any) => m.url)
      const firstVideo = (Array.isArray(p.medias) ? p.medias : []).find((m: any) => m.type === 'video')?.url
      if (images.length) {
        const r = await publishTikTokPhotos(images, docCaption)
        return NextResponse.json({ success: true, type: 'photo', ...r })
      }
      if (firstVideo) {
        const r = await publishTikTokDraft(firstVideo)
        return NextResponse.json({ success: true, ...r })
      }
      return NextResponse.json({ success: false, error: 'aucun média' }, { status: 400 })
    }

    if (!p.videoUrl) return NextResponse.json({ success: false, error: 'aucune vidéo' }, { status: 400 })
    const r = await publishTikTokDraft(p.videoUrl)
    return NextResponse.json({ success: true, ...r })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
