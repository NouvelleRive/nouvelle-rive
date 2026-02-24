import { NextResponse } from 'next/server'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

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