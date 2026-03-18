import { NextResponse } from 'next/server'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { removeFromEbay } from '@/lib/ebay/remove'

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export async function POST() {
  const db = getFirestore()
  const snap = await db.collection('produits')
    .where('vendu', '==', true)
    .get()

  const toRemove = snap.docs.filter(d => d.data().ebayListingId || d.data().ebayOfferId)

  const results = []
  for (const doc of toRemove) {
    const data = doc.data()
    const result = await removeFromEbay(data.sku || doc.id, data.ebayOfferId)
    if (result.success) {
      await doc.ref.update({ ebayListingId: null, ebayOfferId: null })
    }
    results.push({ sku: data.sku, success: result.success, error: result.error })
  }

  return NextResponse.json({ total: toRemove.length, results })
}