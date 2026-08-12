import { adminDb } from '@/lib/firebaseAdmin'
import { publishReel } from '@/lib/igWeekly'

// Publie le contenu réseaux dû (chronique du jour, heure atteinte).
// Réutilisé par /api/cron/reseaux-publish (test/manuel) et par le cron
// /api/cron/reminders (déclenché à heure pile). Ultra léger : lit 1 doc.

const COLL = 'reseauxContenu'

// weekday getDay() → chronique (aligné avec /vendeuse/reseaux)
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
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
  const iso = `${get('year')}-${get('month')}-${get('day')}`
  const hhmm = `${get('hour')}:${get('minute')}`
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(y, m - 1, d, 12).getDay()
  return { iso, hhmm, dow }
}

export async function publishDueReseaux(dryRun = false): Promise<any> {
  const { iso, hhmm, dow } = parisNow()
  const chronique = DAY_TO_CHRONIQUE[dow]
  if (!chronique) return { skipped: 'no chronique today' }

  const ref = adminDb.collection(COLL).doc(`${chronique}_${iso}`)
  const snap = await ref.get()
  if (!snap.exists) return { skipped: 'no production today', chronique, iso }

  const p = snap.data() as any
  if (p.publishedAt) return { skipped: 'already published', chronique }
  if (!p.videoUrl) return { skipped: 'no video', chronique }
  const heure = p.heurePost || '00:00'
  if (hhmm < heure) return { skipped: 'too early', chronique, heure, now: hhmm }

  const collaborators = String(p.collab || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  const caption = p.caption || ''

  if (dryRun) return { dryRun: true, chronique, iso, heure, videoUrl: p.videoUrl, collaborators }

  // Verrou anti-double publication : on pose publishedAt AVANT.
  await ref.set({ publishedAt: Date.now(), status: 'publishing' }, { merge: true })
  try {
    const mediaId = await publishReel(p.videoUrl, caption, { coverUrl: p.vignetteUrl || undefined, collaborators })
    await ref.set({ status: 'published', igMediaId: mediaId, publishError: '' }, { merge: true })
    return { published: true, chronique, mediaId }
  } catch (e: any) {
    await ref.set({ publishedAt: null, status: 'error', publishError: e?.message || 'erreur' }, { merge: true })
    throw e
  }
}
