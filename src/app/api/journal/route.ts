// app/api/journal/route.ts
// GET  : tous les articles (contenu + état éditorial) pour l'admin.
// PUT  : enregistre un article { slug, patch }. Règle : pas de publication sans relecture.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getAllArticlesCached, saveArticle, type ArticlePatch } from '@/lib/journal-store'

export async function GET() {
  try {
    const articles = await getAllArticlesCached()
    return NextResponse.json(
      { articles },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { slug?: string; patch?: ArticlePatch }
    if (!body?.slug || typeof body.slug !== 'string') {
      return NextResponse.json({ error: 'slug manquant' }, { status: 400 })
    }
    const updated = await saveArticle(body.slug, body.patch || {})

    // Rafraîchit les pages publiques concernées.
    revalidatePath('/journal')
    revalidatePath(`/journal/${updated.slug}`)
    revalidatePath('/sitemap.xml')

    const refusePublish = body.patch?.published === true && !updated.published
    return NextResponse.json({
      article: updated,
      warning: refusePublish ? "Publication refusée : l'article doit d'abord être relu." : undefined,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
