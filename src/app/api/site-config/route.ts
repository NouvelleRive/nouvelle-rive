// app/api/site-config/route.ts
// POST { pageId } — invalide le cache serveur de la config d'une page (tag
// `site-config-<pageId>` posé par getPageConfigCached) + la réponse edge de
// /api/page-produits pour ce pageId. Appelé par /admin/site après une save de
// règles → la page publique (ex: /sac) reflète la nouvelle config immédiatement.

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const pageId = String(body?.pageId || '').trim()
    if (!pageId) {
      return NextResponse.json({ error: 'pageId requis' }, { status: 400 })
    }
    revalidateTag(`site-config-${pageId}`)
    // Revalide la route API + la page publique correspondante s'il y en a une (best effort).
    revalidatePath('/api/page-produits')
    revalidatePath(`/${pageId}`)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
