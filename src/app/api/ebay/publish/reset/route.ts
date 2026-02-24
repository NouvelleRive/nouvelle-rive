import { NextResponse } from 'next/server'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { initializeApp, getApps, cert } from 'firebase-admin/app'

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

export async function POST() {
  const snap = await db.collection('produits')
    .where('ebayListingId', '!=', null)
    .get()

  let count = 0
  for (const doc of snap.docs) {
    await doc.ref.update({
      ebayListingId: FieldValue.delete(),
      ebayOfferId: FieldValue.delete(),
      ebayPublishedAt: FieldValue.delete(),
      publishedOn: (doc.data().publishedOn || []).filter((p: string) => p !== 'ebay'),
    })
    count++
  }

  return NextResponse.json({ success: true, cleaned: count })
}