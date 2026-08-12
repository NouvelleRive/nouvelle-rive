// app/api/cron/reseaux-publish/route.ts
// Test/manuel de la publication auto réseaux. La logique vit dans
// lib/reseauxPublish (réutilisée aussi par /api/cron/reminders, déclenché à
// heure pile — pas d'appel toutes les 5 min).
//
// Auth : Bearer CRON_SECRET. ?dryRun=1 : ne poste rien.

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { publishDueReseaux } from '@/lib/reseauxPublish'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'
  try {
    const result = await publishDueReseaux(dryRun)
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
