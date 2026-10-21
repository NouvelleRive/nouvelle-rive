// app/api/code-promo/route.ts
// Aperçu au checkout : le code existe-t-il, quel %, sur quelles pièces.
// Le calcul qui fait foi est refait dans /api/checkout au moment de payer.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { lireCodePromo } from '@/lib/codesPromo'

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()
    const promo = await lireCodePromo(String(code || ''))
    if (!promo) {
      return NextResponse.json({ valid: false }, { headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json({ valid: true, ...promo }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 })
  }
}
