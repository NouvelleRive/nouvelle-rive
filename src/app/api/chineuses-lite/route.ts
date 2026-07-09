// app/api/chineuses-lite/route.ts
// Liste minimale des chineuses pour ProductGrid (vidéos intercalées).
// Cache Vercel 1h — évite 1 scan Firestore par visite publique.

export const runtime = 'nodejs'
export const revalidate = 3600

import { NextResponse } from 'next/server'
import { getChineusesLiteCached } from '@/lib/getChineusesLiteCached'

export async function GET() {
  try {
    const list = await getChineusesLiteCached()
    return NextResponse.json(list, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
