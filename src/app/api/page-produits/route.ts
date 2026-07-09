// app/api/page-produits/route.ts
// Retourne la liste des produits filtrés par pageId (matching siteConfig).
// Remplace la logique client de useFilteredProducts qui scannait toute la
// collection produits + chineuses par visite publique. Cache Vercel 6h.

export const runtime = 'nodejs'
export const revalidate = 21600

import { NextRequest, NextResponse } from 'next/server'
import { getPageProduits } from '@/lib/getPageProduitsCached'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const pageId = searchParams.get('pageId') || ''
    if (!pageId) {
      return NextResponse.json({ error: 'pageId requis' }, { status: 400 })
    }
    const produits = await getPageProduits(pageId)
    return NextResponse.json(
      { produits },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
        },
      },
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
