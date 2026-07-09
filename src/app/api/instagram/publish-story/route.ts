import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'

const IG_BUSINESS_ID = process.env.IG_BUSINESS_ACCOUNT_ID
const IG_TOKEN = process.env.IG_PAGE_ACCESS_TOKEN
const API_VERSION = 'v25.0'

export async function POST(req: NextRequest) {
  try {
    if (!IG_BUSINESS_ID || !IG_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Instagram non configuré (env vars manquantes)' },
        { status: 500 }
      )
    }

    const { productId } = await req.json()
    if (!productId) {
      return NextResponse.json({ success: false, error: 'productId requis' }, { status: 400 })
    }

    const snap = await adminDb.collection('produits').doc(productId).get()
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: 'produit introuvable' }, { status: 404 })
    }
    const p = snap.data() as any
    const imageUrl = p.photos?.faceOnModel || p.photos?.face || p.imageUrls?.[0] || p.imageUrl
    if (!imageUrl) {
      return NextResponse.json({ success: false, error: 'aucune photo pour ce produit' }, { status: 400 })
    }

    // 1) Créer le container media STORIES
    const containerRes = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${IG_BUSINESS_ID}/media?media_type=STORIES&image_url=${encodeURIComponent(imageUrl)}&access_token=${IG_TOKEN}`,
      { method: 'POST' }
    )
    const containerData = await containerRes.json()
    if (!containerData.id) {
      return NextResponse.json(
        { success: false, error: 'création container échouée', details: containerData },
        { status: 500 }
      )
    }

    // 2) Publier le container
    const publishRes = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${IG_BUSINESS_ID}/media_publish?creation_id=${containerData.id}&access_token=${IG_TOKEN}`,
      { method: 'POST' }
    )
    const publishData = await publishRes.json()
    if (!publishData.id) {
      return NextResponse.json(
        { success: false, error: 'publication échouée', details: publishData },
        { status: 500 }
      )
    }

    await adminDb.collection('produits').doc(productId).update({
      igStoryPublishedAt: new Date(),
      igStoryMediaId: publishData.id,
    })

    return NextResponse.json({ success: true, mediaId: publishData.id })
  } catch (err: any) {
    console.error('[ig/publish-story] erreur:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'erreur inconnue' },
      { status: 500 }
    )
  }
}
