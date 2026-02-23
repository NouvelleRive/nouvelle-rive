import { NextRequest, NextResponse } from 'next/server'
import { getFirestore } from 'firebase-admin/firestore'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { updateOnAllChannels } from '@/lib/syncUpdateOnAllChannels'

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

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-api-secret')
    if (secret !== (process.env.API_SECRET || 'NR_INTERNAL_SYNC_2026')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { productId } = await request.json()
    if (!productId) {
      return NextResponse.json({ error: 'productId requis' }, { status: 400 })
    }

    const docSnap = await db.collection('produits').doc(productId).get()
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Produit non trouvé' }, { status: 404 })
    }

    const produitData: any = { id: docSnap.id, ...docSnap.data() }
    const results = await updateOnAllChannels(produitData)

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error('❌ Erreur sync product:', error?.message)
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
