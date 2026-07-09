import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'

const FB_PAGE_ID = process.env.IG_PAGE_ID
const FB_TOKEN = process.env.IG_PAGE_ACCESS_TOKEN
const API_VERSION = 'v25.0'

export async function POST(req: NextRequest) {
  try {
    if (!FB_PAGE_ID || !FB_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Facebook non configuré (env vars manquantes)' },
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

    const nom = (p.nom || '').replace(`${p.sku || ''} - `, '')
    const marque = p.marque || ''
    const prix = p.prix ? `${p.prix}€` : ''
    const parts = [
      marque && `${marque}`,
      nom,
      prix,
      '',
      `👉 nouvellerive.eu/boutique/${productId}`,
    ].filter(Boolean)
    const message = parts.join('\n')

    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${FB_PAGE_ID}/photos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: imageUrl,
          message,
          access_token: FB_TOKEN,
        }),
      }
    )
    const data = await res.json()
    if (!data.id && !data.post_id) {
      return NextResponse.json(
        { success: false, error: 'publication échouée', details: data },
        { status: 500 }
      )
    }

    await adminDb.collection('produits').doc(productId).update({
      fbPostPublishedAt: new Date(),
      fbPostId: data.post_id || data.id,
    })

    return NextResponse.json({ success: true, postId: data.post_id || data.id })
  } catch (err: any) {
    console.error('[fb/publish-post] erreur:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'erreur inconnue' },
      { status: 500 }
    )
  }
}
