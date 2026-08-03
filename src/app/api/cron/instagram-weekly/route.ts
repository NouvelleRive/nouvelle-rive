// app/api/cron/instagram-weekly/route.ts
// Cron « next fav » IG hebdo. Deux étapes, gatées côté cron Firebase :
//   ?step=candidates  (mardi)   → prépare 4/5 propositions fond blanc à valider
//   ?step=publish     (mercredi) → publie en feed la pièce validée en admin
//
// Auth : Bearer CRON_SECRET. Idempotent (doc igWeekly/{mercredi}).
// ?dryRun=1 : ne publie/écrit rien de définitif, renvoie ce qui serait fait.

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import {
  upcomingWednesdayId,
  buildCandidates,
  weeklyRef,
  getWeekly,
  publishFeed,
} from '@/lib/igWeekly'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }

  const step = req.nextUrl.searchParams.get('step')
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'
  const weekId = upcomingWednesdayId()

  try {
    if (step === 'candidates') {
      const existing = await getWeekly(weekId)
      // Ne pas écraser une validation déjà faite (ni un post déjà publié).
      if (existing && existing.status !== 'pending') {
        return NextResponse.json({ success: true, weekId, skipped: `déjà ${existing.status}` })
      }
      const candidates = await buildCandidates()
      if (dryRun) {
        return NextResponse.json({ success: true, weekId, dryRun: true, candidates })
      }
      await weeklyRef(weekId).set(
        {
          weekOf: weekId,
          status: 'pending',
          candidates,
          createdAt: new Date(),
        },
        { merge: true }
      )
      return NextResponse.json({ success: true, weekId, count: candidates.length })
    }

    if (step === 'publish') {
      const doc = await getWeekly(weekId)
      if (!doc) {
        return NextResponse.json({ success: true, weekId, skipped: 'aucun doc cette semaine' })
      }
      if (doc.status === 'published') {
        return NextResponse.json({ success: true, weekId, skipped: 'déjà publié', igMediaId: doc.igMediaId })
      }
      if (doc.status !== 'chosen' || !doc.chosenProductId) {
        return NextResponse.json({ success: true, weekId, skipped: `non validé (${doc.status})` })
      }
      const chosen = doc.candidates.find((c) => c.productId === doc.chosenProductId)
      if (!chosen) {
        return NextResponse.json({ success: false, weekId, error: 'pièce validée introuvable' }, { status: 400 })
      }
      const caption = doc.caption || ''
      if (dryRun) {
        return NextResponse.json({ success: true, weekId, dryRun: true, would: { imageUrl: chosen.imageUrl, caption } })
      }

      const mediaId = await publishFeed(chosen.imageUrl, caption)

      await weeklyRef(weekId).set(
        { status: 'published', igMediaId: mediaId, publishedAt: new Date(), error: null },
        { merge: true }
      )
      // Stamp la pièce pour le cooldown (exclusion des prochaines sélections).
      await adminDb.collection('produits').doc(chosen.productId).set(
        { igWeeklyFeaturedAt: new Date(), igWeeklyMediaId: mediaId },
        { merge: true }
      )
      return NextResponse.json({ success: true, weekId, igMediaId: mediaId, productId: chosen.productId })
    }

    return NextResponse.json({ success: false, error: 'step invalide (candidates|publish)' }, { status: 400 })
  } catch (err: any) {
    // En cas d'échec de publication, on garde une trace pour l'admin.
    if (step === 'publish' && !dryRun) {
      try {
        await weeklyRef(weekId).set({ error: err?.message || 'erreur inconnue' }, { merge: true })
      } catch {}
    }
    console.error('[cron/instagram-weekly]', err)
    return NextResponse.json({ success: false, weekId, error: err?.message || 'erreur' }, { status: 500 })
  }
}
