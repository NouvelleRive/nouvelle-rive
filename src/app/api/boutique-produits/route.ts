// app/api/boutique-produits/route.ts
// Toute la boutique (page /boutique = "TOUT VOIR"), triée par plus récent, cachée 6h à l'edge.
// La logique de filtre + tri est mutualisée dans getAllBoutiqueProduitsServer, qui repose sur
// getAllProduitsCached (blob 6h + memory + dedupe inflight) → 0 read Firestore par visite.

export const runtime = 'nodejs'
export const revalidate = 21600

import { NextResponse } from 'next/server'
import { getAllBoutiqueProduitsServer } from '@/lib/produitsServer'

export async function GET() {
  try {
    const produits = await getAllBoutiqueProduitsServer()
    return NextResponse.json(
      { produits },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
        },
      },
    )
  } catch (e: any) {
    console.error('[API BOUTIQUE-PRODUITS]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
