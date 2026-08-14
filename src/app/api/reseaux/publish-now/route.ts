// app/api/reseaux/publish-now/route.ts
// Publication immédiate d'une prod (bouton « Poster maintenant »).
// Réutilise le posteur partagé (lib/reseauxPublish → publishReel).

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { publishProduction } from '@/lib/reseauxPublish'

export async function POST(req: NextRequest) {
  try {
    const { chronique, date } = await req.json()
    if (!chronique || !date) {
      return NextResponse.json({ success: false, error: 'chronique/date requis' }, { status: 400 })
    }
    const result = await publishProduction(chronique, date)
    if (result?.skipped) {
      return NextResponse.json({ success: false, error: result.skipped })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
