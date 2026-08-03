// app/api/admin/instagram-weekly/route.ts
// Backend de l'écran /admin/instagram (validation du post « next fav » hebdo).
//
// GET  → doc de la semaine (génère les candidats à la volée s'il n'existe pas)
// POST → actions : choose | skip | regenerate | publishNow
//
// Auth : Firebase ID token de l'admin.

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import {
  upcomingWednesdayId,
  buildCandidates,
  weeklyRef,
  getWeekly,
  defaultCaption,
  defaultBioLine,
  publishFeed,
  type IgWeeklyDoc,
} from '@/lib/igWeekly'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!token) return false
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    return decoded.email === ADMIN_EMAIL
  } catch {
    return false
  }
}

async function ensureWeek(weekId: string): Promise<IgWeeklyDoc> {
  const existing = await getWeekly(weekId)
  if (existing) return existing
  const candidates = await buildCandidates()
  const doc: IgWeeklyDoc = { weekOf: weekId, status: 'pending', candidates, createdAt: new Date() }
  await weeklyRef(weekId).set(doc, { merge: true })
  return doc
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }
  const weekId = upcomingWednesdayId()
  const doc = await ensureWeek(weekId)
  return NextResponse.json(
    { success: true, weekId, doc },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }

  const weekId = upcomingWednesdayId()
  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  try {
    if (action === 'regenerate') {
      const candidates = await buildCandidates()
      await weeklyRef(weekId).set(
        { weekOf: weekId, status: 'pending', candidates, chosenProductId: null, createdAt: new Date() },
        { merge: true }
      )
      return NextResponse.json({ success: true, weekId, doc: await getWeekly(weekId) })
    }

    if (action === 'skip') {
      await weeklyRef(weekId).set({ status: 'skipped' }, { merge: true })
      return NextResponse.json({ success: true, weekId, doc: await getWeekly(weekId) })
    }

    if (action === 'choose') {
      const { productId, caption, bioLine } = body
      const doc = await getWeekly(weekId)
      if (!doc) return NextResponse.json({ success: false, error: 'semaine introuvable' }, { status: 404 })
      const chosen = doc.candidates.find((c) => c.productId === productId)
      if (!chosen) return NextResponse.json({ success: false, error: 'pièce hors candidats' }, { status: 400 })
      await weeklyRef(weekId).set(
        {
          status: 'chosen',
          chosenProductId: productId,
          caption: typeof caption === 'string' ? caption : defaultCaption(chosen),
          bioLine: typeof bioLine === 'string' ? bioLine : defaultBioLine(chosen),
          chosenAt: new Date(),
        },
        { merge: true }
      )
      return NextResponse.json({ success: true, weekId, doc: await getWeekly(weekId) })
    }

    if (action === 'publishNow') {
      const doc = await getWeekly(weekId)
      if (!doc?.chosenProductId) {
        return NextResponse.json({ success: false, error: 'aucune pièce validée' }, { status: 400 })
      }
      const chosen = doc.candidates.find((c) => c.productId === doc.chosenProductId)
      if (!chosen) return NextResponse.json({ success: false, error: 'pièce validée introuvable' }, { status: 400 })
      const mediaId = await publishFeed(chosen.imageUrl, doc.caption || '')
      await weeklyRef(weekId).set(
        { status: 'published', igMediaId: mediaId, publishedAt: new Date(), error: null },
        { merge: true }
      )
      await adminDb.collection('produits').doc(chosen.productId).set(
        { igWeeklyFeaturedAt: new Date(), igWeeklyMediaId: mediaId },
        { merge: true }
      )
      return NextResponse.json({ success: true, weekId, igMediaId: mediaId, doc: await getWeekly(weekId) })
    }

    return NextResponse.json({ success: false, error: 'action invalide' }, { status: 400 })
  } catch (err: any) {
    console.error('[admin/instagram-weekly]', err)
    return NextResponse.json({ success: false, error: err?.message || 'erreur' }, { status: 500 })
  }
}
