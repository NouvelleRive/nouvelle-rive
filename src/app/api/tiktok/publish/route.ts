// app/api/tiktok/publish/route.ts
// Dépose la vidéo d'une prod en brouillon sur TikTok (Content Posting API).

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { publishTikTokDraft } from '@/lib/tiktokPublish'

export async function POST(req: NextRequest) {
  try {
    const { chronique, date, videoUrl } = await req.json()
    let url = videoUrl
    if (!url && chronique && date) {
      const snap = await adminDb.collection('reseauxContenu').doc(`${chronique}_${date}`).get()
      const p = snap.exists ? (snap.data() as any) : null
      url = p?.videoUrl || (Array.isArray(p?.medias) && p.medias.find((m: any) => m.type === 'video')?.url) || ''
    }
    if (!url) return NextResponse.json({ success: false, error: 'aucune vidéo' }, { status: 400 })

    const { publishId, status } = await publishTikTokDraft(url)
    return NextResponse.json({ success: true, publishId, status })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
