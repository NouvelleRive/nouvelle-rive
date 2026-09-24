// app/api/cache/refresh-chineuses/route.ts
// Une chineuse créée/modifiée en admin n'apparaissait pas avant 6h (TTL du blob
// `chineuses-lite-v2`) + 1h (ISR de /nos-creatrices). Cette route reconstruit le
// blob et purge les pages qui l'utilisent.
//
// 1 scan de `chineuse` (~40 docs) par appel — déclenché à la main ou par la page
// admin après enregistrement, jamais par un visiteur.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { forceRefreshChineusesBlob } from '@/lib/getChineusesLiteCached'

const PATHS = ['/nos-creatrices', '/api/chineuses-lite', '/boutique']

export async function POST() {
  try {
    const count = await forceRefreshChineusesBlob()
    for (const p of PATHS) {
      try { revalidatePath(p) } catch { /* best effort */ }
    }
    return NextResponse.json({ success: true, count, revalidated: PATHS.length })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}
