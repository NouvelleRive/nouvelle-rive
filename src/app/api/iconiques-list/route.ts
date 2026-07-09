// app/api/iconiques-list/route.ts
// Retourne la liste des iconiques affichables filtrée par type (vintage|upcy).
// Cache serveur mutualisé 6h — évite un getDocs collection('iconiques') par visite.

export const runtime = 'nodejs'
export const revalidate = 21600

import { NextRequest, NextResponse } from 'next/server'
import { getIconiquesCached } from '@/lib/getIconiquesCached'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'vintage'
    const all = await getIconiquesCached()
    const list = all
      .filter(i => i.displayOnWebsite !== false && (i.type || 'vintage') === type)
      .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
    return NextResponse.json(
      { iconiques: list },
      { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } },
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
