// app/api/ebay/resync/route.ts
// Re-pousse les modifications (description notamment) vers eBay sur des produits déjà publiés.
// - POST avec { productId } : resync d'un seul produit (utilisé après chaque sauvegarde admin)
// - GET avec ?all=1 et header Authorization Bearer CRON_SECRET : resync de tous les produits avec ebayListingId

import { NextRequest, NextResponse } from 'next/server'
import { getFirestore } from 'firebase-admin/firestore'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { updateEbayListing, prepareProductForEbay, wearTypeToGender, isEbayConfigured, type EbayGender } from '@/lib/ebay'

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = getFirestore()

const wearTypeCache: Map<string, string> = new Map()
async function getWearTypeByTrigramme(trigramme: string): Promise<string | null> {
  if (!trigramme) return null
  const tri = trigramme.toUpperCase().trim()
  if (wearTypeCache.has(tri)) return wearTypeCache.get(tri) || null
  try {
    const snap = await db.collection('chineuse').where('trigramme', '==', tri).limit(1).get()
    if (!snap.empty) {
      const wearType = snap.docs[0].data().wearType || 'womenswear'
      wearTypeCache.set(tri, wearType)
      return wearType
    }
  } catch {}
  return null
}

async function resyncOne(productId: string): Promise<{ ok: boolean; sku?: string; error?: string }> {
  const docRef = db.collection('produits').doc(productId)
  const snap = await docRef.get()
  if (!snap.exists) return { ok: false, error: 'product-not-found' }
  const p = { id: snap.id, ...snap.data() } as any
  if (!p.ebayListingId || !p.ebayOfferId) return { ok: false, sku: p.sku, error: 'not-on-ebay' }

  const tri = (p.chineuse || p.trigramme || (p.sku ? p.sku.match(/^([A-Z]{2,4})/i)?.[1] : null) || '').toString().toUpperCase()
  const wearType = await getWearTypeByTrigramme(tri)
  const gender: EbayGender | undefined = wearTypeToGender(wearType || undefined) || undefined

  const ebayProduct = prepareProductForEbay(p, gender)
  if (ebayProduct.imageUrls.length === 0) return { ok: false, sku: p.sku, error: 'no-image' }

  try {
    const result = await updateEbayListing(ebayProduct, p.ebayOfferId)
    if (!result.success) return { ok: false, sku: p.sku, error: result.error }
    await docRef.update({ ebayLastResyncAt: new Date().toISOString() })
    return { ok: true, sku: p.sku }
  } catch (e: any) {
    return { ok: false, sku: p.sku, error: e?.message || 'unknown' }
  }
}

export async function POST(req: NextRequest) {
  if (!isEbayConfigured()) {
    return NextResponse.json({ success: false, error: 'ebay-non-configure' }, { status: 500 })
  }
  const body = await req.json().catch(() => ({}))
  const productId = body?.productId
  if (!productId) return NextResponse.json({ success: false, error: 'productId-required' }, { status: 400 })

  const result = await resyncOne(productId)
  return NextResponse.json({ success: result.ok, ...result })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === '1'
  if (!all) return NextResponse.json({ success: false, error: 'use-?all=1-for-bulk' }, { status: 400 })

  // Auth via CRON_SECRET pour le bulk
  const auth = req.headers.get('authorization') || ''
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!isEbayConfigured()) {
    return NextResponse.json({ success: false, error: 'ebay-non-configure' }, { status: 500 })
  }

  const max = Math.max(1, parseInt(searchParams.get('max') || '100', 10))
  const snap = await db.collection('produits').where('ebayListingId', '!=', null).get()
  const produits = snap.docs.slice(0, max).map(d => ({ id: d.id, ...d.data() } as any))

  const results: Array<{ id: string; sku?: string; ok: boolean; error?: string }> = []
  for (const p of produits) {
    const r = await resyncOne(p.id)
    results.push({ id: p.id, sku: p.sku, ok: r.ok, error: r.error })
  }

  const ok = results.filter(r => r.ok).length
  const ko = results.length - ok
  return NextResponse.json({ success: true, total: results.length, ok, ko, results })
}
