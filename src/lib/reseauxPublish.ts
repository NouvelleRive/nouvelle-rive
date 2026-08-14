import { adminDb, adminStorage } from '@/lib/firebaseAdmin'
import { publishReel, publishCarousel } from '@/lib/igWeekly'

// Supprime le fichier vidéo une fois publié sur IG (il y vit désormais).
// Gère Firebase Storage et Bunny. Non bloquant : un échec n'annule pas la publi.
async function deletePublishedVideo(url: string): Promise<void> {
  try {
    const fb = url.match(/\/b\/([^/]+)\/o\/([^?]+)/) // …/v0/b/{bucket}/o/{path}?…
    if (fb) {
      await adminStorage.bucket(fb[1]).file(decodeURIComponent(fb[2])).delete({ ignoreNotFound: true } as any)
      return
    }
    if (url.includes('.b-cdn.net/')) {
      const zone = process.env.BUNNY_STORAGE_ZONE
      const key = process.env.BUNNY_API_KEY
      const path = url.split('.b-cdn.net/')[1]?.split('?')[0]
      if (zone && key && path) {
        await fetch(`https://storage.bunnycdn.com/${zone}/${path}`, { method: 'DELETE', headers: { AccessKey: key } })
      }
    }
  } catch (e) {
    console.error('deletePublishedVideo failed:', e)
  }
}

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
  const hasMedia = p.format === 'publi' ? (Array.isArray(p.medias) && p.medias.length > 0) : !!p.videoUrl
  if (!hasMedia) return { skipped: 'no media', chronique }
  const heure = p.heurePost || '00:00'
  if (hhmm < heure) return { skipped: 'too early', chronique, heure, now: hhmm }

  const collaborators = String(p.collab || '').split(',').map((s: string) => s.trim()).filter(Boolean)

  if (dryRun) return { dryRun: true, chronique, iso, heure, format: p.format || 'reel', collaborators }

  return doPublish(ref, p, chronique)
}

// Publication effective d'une prod (container→publish, purge vidéo). Partagé.
async function doPublish(ref: FirebaseFirestore.DocumentReference, p: any, chronique: string): Promise<any> {
  const collaborators = String(p.collab || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  const caption = p.caption || ''
  // Verrou anti-double publication : on pose publishedAt AVANT.
  await ref.set({ publishedAt: Date.now(), status: 'publishing' }, { merge: true })
  try {
    let mediaId: string
    if (p.format === 'publi') {
      mediaId = await publishCarousel(p.medias || [], caption, { collaborators })
      // Purge les médias (gros) une fois publiés.
      await Promise.all((p.medias || []).map((m: any) => deletePublishedVideo(m.url)))
      await ref.set({ status: 'published', igMediaId: mediaId, publishError: '', medias: [] }, { merge: true })
    } else {
      mediaId = await publishReel(p.videoUrl, caption, { coverUrl: p.vignetteUrl || undefined, collaborators })
      await deletePublishedVideo(p.videoUrl) // on garde la vignette pour l'aperçu
      await ref.set({ status: 'published', igMediaId: mediaId, publishError: '', videoUrl: '' }, { merge: true })
    }
    return { published: true, chronique, mediaId }
  } catch (e: any) {
    await ref.set({ publishedAt: null, status: 'error', publishError: e?.message || 'erreur' }, { merge: true })
    throw e
  }
}

// Publication immédiate d'une prod précise (bouton « Poster maintenant »),
// sans regarder le jour ni l'heure.
export async function publishProduction(chronique: string, date: string): Promise<any> {
  const ref = adminDb.collection(COLL).doc(`${chronique}_${date}`)
  const snap = await ref.get()
  if (!snap.exists) return { skipped: 'introuvable' }
  const p = snap.data() as any
  if (p.publishedAt) return { skipped: 'already published' }
  const hasMedia = p.format === 'publi' ? (Array.isArray(p.medias) && p.medias.length > 0) : !!p.videoUrl
  if (!hasMedia) throw new Error('Rien à publier')
  return doPublish(ref, p, chronique)
}
