// app/api/push/subscribe/route.ts
// POST { ownerId, subscription } → enregistre la subscription pour un owner
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { upsertSubscription } from '@/lib/webpush'

export async function POST(req: NextRequest) {
  try {
    const { ownerId, subscription } = await req.json()
    if (!ownerId || !subscription?.endpoint) {
      return NextResponse.json({ success: false, error: 'ownerId et subscription requis' }, { status: 400 })
    }
    const r = await upsertSubscription(ownerId, subscription)
    return NextResponse.json({ success: true, id: r.id })
  } catch (err: any) {
    console.error('[API PUSH SUBSCRIBE]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}
