// app/api/sync-ventes/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { syncVentesDepuisSquare } from '@/lib/syncSquareToFirestore'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { startDate, endDate } = body

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate et endDate requis' },
        { status: 400 }
      )
    }

    console.log(`🔄 Sync ventes du ${startDate} au ${endDate}`)

    const result = await syncVentesDepuisSquare(startDate, endDate)

    return NextResponse.json({
      success: true,
      message: result.message,
      imported: result.nbImported,
      attribuees: result.nbAttribuees,
      nonAttribuees: result.nbNonAttribuees,
      skipped: result.nbSkipped,
    })
  } catch (err: any) {
    console.error('[API SYNC VENTES]', err)
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    )
  }
}