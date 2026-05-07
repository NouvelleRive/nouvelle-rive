// app/api/produits/remove-ebay/route.ts
// Retire un produit d'eBay (et nettoie les ids Firestore correspondants).
// Appelé depuis les composants client qui marquent un produit comme non-vendable
// sans passer par /api/delete-produits.
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { removeFromAllChannels } from '@/lib/syncRemoveFromAllChannels'

export async function POST(req: NextRequest) {
  try {
    const { productId } = await req.json()
    if (!productId) return NextResponse.json({ success: false, error: 'productId manquant' }, { status: 400 })

    const snap = await adminDb.collection('produits').doc(String(productId)).get()
    if (!snap.exists) return NextResponse.json({ success: true, action: 'noop', reason: 'introuvable' })

    const data = snap.data() as any
    if (!data.ebayListingId && !data.ebayOfferId) {
      return NextResponse.json({ success: true, action: 'noop', reason: 'pas-sur-ebay' })
    }

    await removeFromAllChannels({
      id: String(productId),
      sku: data.sku,
      ebayOfferId: data.ebayOfferId,
      ebayListingId: data.ebayListingId,
    })

    return NextResponse.json({ success: true, action: 'removed' })
  } catch (e: any) {
    console.error('❌ remove-ebay:', e?.message || e)
    return NextResponse.json({ success: false, error: e?.message || 'erreur' }, { status: 500 })
  }
}
