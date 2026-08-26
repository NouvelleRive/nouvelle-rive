import { adminDb, adminStorage } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { publishCarousel, createReelContainer, finalizePublish } from '@/lib/igWeekly'

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

  // Chronique mise en pause manuellement (bouton pause) → pas d'auto-publish.
  const susp = await adminDb.collection('reseauxConfig').doc('suspended').get()
  if (susp.exists && (susp.data() as any)?.[chronique] === true) return { skipped: 'suspended', chronique }

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
    } else {
      // Reel repostable : on RÉUTILISE le container mémorisé s'il est encore
      // valide (< 6 h). Sinon on en crée un neuf et on le mémorise AVANT de
      // finaliser → si la finalisation dépasse le délai (vidéo lente à traiter),
      // le prochain passage du cron reprend le même container au lieu de rester
      // bloqué. Aucun doublon : rien n'est publié tant que finalizePublish n'a
      // pas appelé media_publish.
      const recent = typeof p.pendingContainerAt === 'number' && Date.now() - p.pendingContainerAt < 6 * 3600 * 1000
      let containerId: string = recent && p.pendingContainerId ? p.pendingContainerId : ''
      if (!containerId) {
        containerId = await createReelContainer(p.videoUrl, caption, { coverUrl: p.vignetteUrl || undefined, collaborators })
        await ref.set({ pendingContainerId: containerId, pendingContainerAt: Date.now() }, { merge: true })
      }
      mediaId = await finalizePublish(containerId, 20, 2500)
      await deletePublishedVideo(p.videoUrl)
    }
    // Publié sur IG → on SUPPRIME la prod de l'app (elle disparaît de New contenu & du feed).
    await ref.delete()
    return { published: true, chronique, mediaId }
  } catch (e: any) {
    const msg = e?.message || 'erreur'
    // Échecs survenus AVANT tout media_publish → RIEN n'a été posté → on LIBÈRE
    // le verrou (publishedAt) pour que le prochain passage horaire du cron
    // réessaie (reel : reprise du container mémorisé ; sinon container recréé).
    // C'est le cas du « container pas prêt (timeout) » qui laissait le reel
    // bloqué définitivement. Seul « publication échouée » (media_publish appelé,
    // réponse ambiguë) GARDE le verrou : IG a pu publier, réessayer = doublon.
    const nothingPosted =
      /container pas prêt \(timeout\)/.test(msg) ||        // container jamais FINISHED
      /traitement média échoué/.test(msg) ||               // status=ERROR avant publish
      /container (reel|enfant|carrousel) échoué|création container/.test(msg) || // container jamais créé
      /"is_transient"\s*:\s*false/.test(msg)
    await ref.set(
      { status: 'error', publishError: msg, ...(nothingPosted ? { publishedAt: FieldValue.delete() } : {}) },
      { merge: true },
    )
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
