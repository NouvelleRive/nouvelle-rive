// app/api/chineuses-lite/route.ts
// Liste minimale des chineuses pour ProductGrid (vidéos intercalées).
// Cache Vercel 1h — évite 1 scan Firestore par visite publique.

export const runtime = 'nodejs'
export const revalidate = 3600

import { NextResponse } from 'next/server'
import { getChineusesLiteCached } from '@/lib/getChineusesLiteCached'

export async function GET() {
  try {
    const full = await getChineusesLiteCached()
    // Strip les champs privés (authUid, descriptions…) avant exposition publique.
    const publicList = full.map(c => ({
      uid: c.uid,
      slug: c.slug,
      trigramme: c.trigramme,
      email: c.email,
      emails: c.emails,
      videos: c.videos,
      // nom = nom public de la créatrice (déjà affiché sur /nos-creatrices) :
      // permet à la recherche boutique de retrouver ses pièces par son nom,
      // le SKU ne portant que le trigramme.
      nom: c.nom || '',
    }))
    return NextResponse.json(publicList, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
