// app/api/push/test/route.ts
// GET /api/push/test?owner=boutique → envoie une push de test et renvoie le résultat
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { sendPushToOwner } from '@/lib/webpush'
import { adminDb } from '@/lib/firebaseAdmin'

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get('owner') || 'boutique'

  const subsSnap = await adminDb.collection('pushSubscriptions').where('ownerId', '==', owner).get()
  const subsCount = subsSnap.size

  const results = await sendPushToOwner(owner, {
    title: '🧪 Test Nouvelle Rive',
    body: `Test push pour ${owner} — ${new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' })}`,
    url: '/vendeuse/calendrier',
    tag: `test-${Date.now()}`,
  })

  return NextResponse.json({
    owner,
    subscriptionsInDb: subsCount,
    sent: results.length,
    ok: results.filter(r => r.ok).length,
    details: results,
  })
}
