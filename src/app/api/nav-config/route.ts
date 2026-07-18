// app/api/nav-config/route.ts
// GET  : renvoie la config nav publique (doc siteConfig/_nav), cachée 6h à l'edge
//        + blob cache 6h côté serveur → 0 read Firestore par visite publique.
// POST : invalide le blob cache (mémoire worker + blob Firebase Storage) et
//        force la revalidation edge. Appelée par NavManager après une save
//        pour que le changement d'ordre/label soit visible immédiatement.

export const runtime = 'nodejs'
export const revalidate = 21600

import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { adminStorage } from '@/lib/firebaseAdmin'
import { getNavPagesCached, resetNavPagesMemoryCache } from '@/lib/getNavPagesCached'

export async function GET() {
  try {
    const pages = await getNavPagesCached()
    return NextResponse.json(
      { pages },
      { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } },
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}

export async function POST() {
  try {
    resetNavPagesMemoryCache()
    try {
      const file = adminStorage.bucket().file('_cache/nav-config.json.gz')
      const [exists] = await file.exists()
      if (exists) await file.delete()
    } catch {
      /* pas grave si le blob n'existe pas */
    }
    // Invalide la réponse edge de /api/nav-config lui-même + la home layout (où
    // NavbarPublic est monté). NavbarPublic fetch en no-store donc la prochaine visite
    // tape le serveur qui renverra du frais.
    revalidatePath('/api/nav-config')
    revalidatePath('/', 'layout')
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
