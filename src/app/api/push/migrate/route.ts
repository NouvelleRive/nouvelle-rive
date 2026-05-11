// app/api/push/migrate/route.ts
// POST { oldEndpoint, subscription } → migre une subscription révoquée par iOS/Chrome
// vers son nouvel endpoint, en conservant l'ownerId d'origine.
// Appelé automatiquement par sw-push.js sur l'event `pushsubscriptionchange`.
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { upsertSubscription } from '@/lib/webpush'

export async function POST(req: NextRequest) {
  try {
    const { oldEndpoint, subscription } = await req.json()
    if (!subscription?.endpoint) {
      return NextResponse.json({ success: false, error: 'subscription requise' }, { status: 400 })
    }
    let ownerId: string | null = null
    if (oldEndpoint) {
      const snap = await adminDb.collection('pushSubscriptions').where('endpoint', '==', oldEndpoint).limit(1).get()
      if (!snap.empty) {
        ownerId = snap.docs[0].data().ownerId || null
        await snap.docs[0].ref.delete()
      }
    }
    if (!ownerId) {
      return NextResponse.json({ success: false, error: 'owner introuvable (ancien endpoint inconnu)' }, { status: 404 })
    }
    const r = await upsertSubscription(ownerId, subscription)
    return NextResponse.json({ success: true, id: r.id, ownerId })
  } catch (err: any) {
    console.error('[API PUSH MIGRATE]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}
