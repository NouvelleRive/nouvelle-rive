// app/api/cron/reseaux-publish/route.ts
// Publie automatiquement le contenu réseaux du jour à l'heure prévue.
//
// Appelé toutes les 5 min par pingReminders (Firebase Functions) — pas de
// nouveau Cloud Scheduler (les 3 gratuits sont pris). Ultra cheap : chaque jour
// UNE seule chronique tombe (jour de semaine → chronique), on lit 1 seul doc.
//
// Auth : Bearer CRON_SECRET. Idempotent (flag publishedAt sur le doc).
// ?dryRun=1 : renvoie ce qui serait publié sans rien poster.

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { publishReel } from '@/lib/igWeekly'

const CRON_SECRET = process.env.CRON_SECRET
const COLL = 'reseauxContenu'

// weekday getDay() → chronique (aligné avec la page /vendeuse/reseaux)
const DAY_TO_CHRONIQUE: Record<number, string> = {
  0: 'infinite-slider',
  1: 'compo-de-lo',
  2: 'book-olga',
  3: 'le-rideau',
  4: 'microboutique-hina',
  5: 'shabbat-quote',
  6: 'energies-sarah',
}

// Date/heure locales Paris (les heures de post sont saisies en heure de Paris).
function parisNow() {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
  const iso = `${get('year')}-${get('month')}-${get('day')}`
  const hhmm = `${get('hour')}:${get('minute')}`
  // getDay via une date construite à midi (évite les soucis de fuseau)
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(y, m - 1, d, 12).getDay()
  return { iso, hhmm, dow }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  try {
    const { iso, hhmm, dow } = parisNow()
    const chronique = DAY_TO_CHRONIQUE[dow]
    if (!chronique) return NextResponse.json({ success: true, skipped: 'no chronique today' })

    const ref = adminDb.collection(COLL).doc(`${chronique}_${iso}`)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ success: true, skipped: 'no production today', chronique, iso })

    const p = snap.data() as any

    if (p.publishedAt) return NextResponse.json({ success: true, skipped: 'already published', chronique })
    if (!p.videoUrl) return NextResponse.json({ success: true, skipped: 'no video', chronique })
    // Heure de post atteinte ? (si non renseignée, on part sur 00:00)
    const heure = p.heurePost || '00:00'
    if (hhmm < heure) return NextResponse.json({ success: true, skipped: 'too early', chronique, heure, now: hhmm })

    const collaborators = String(p.collab || '').split(',').map((s: string) => s.trim()).filter(Boolean)
    const caption = p.caption || ''

    if (dryRun) {
      return NextResponse.json({ success: true, dryRun: true, chronique, iso, heure, videoUrl: p.videoUrl, collaborators })
    }

    // Verrou anti-double publication : on pose publishedAt AVANT (si deux ticks
    // se chevauchent, le second verra le flag). En cas d'échec, on le relâche.
    await ref.set({ publishedAt: Date.now(), status: 'publishing' }, { merge: true })
    try {
      const mediaId = await publishReel(p.videoUrl, caption, { coverUrl: p.vignetteUrl || undefined, collaborators })
      await ref.set({ status: 'published', igMediaId: mediaId, publishError: '' }, { merge: true })
      return NextResponse.json({ success: true, published: true, chronique, mediaId })
    } catch (e: any) {
      // Relâche le verrou pour réessayer au prochain tick.
      await ref.set({ publishedAt: null, status: 'error', publishError: e?.message || 'erreur' }, { merge: true })
      return NextResponse.json({ success: false, error: e?.message || 'publication échouée', chronique }, { status: 500 })
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
