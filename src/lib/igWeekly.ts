// =============================================================================
// Post Instagram hebdo « next fav » (fond blanc).
//
// Flux : mardi l'app propose 4/5 pièces fond blanc → validation admin
// (/admin/instagram) → mercredi publication auto en feed IG.
//
// Toute la sélection lit getAllProduitsCached (cache blob, 0 read Firestore) —
// cf. règle « zéro facture Firestore ». L'état hebdo vit dans un seul doc
// Firestore `igWeekly/{YYYY-MM-DD}` (id = le mercredi ciblé → idempotent).
// =============================================================================

import { adminDb } from '@/lib/firebaseAdmin'
import { getAllProduitsCached } from '@/lib/getAllProduitsCached'
import { buildProduitPath } from '@/lib/produitSlug'

const IG_BUSINESS_ID = process.env.IG_BUSINESS_ACCOUNT_ID
const IG_TOKEN = process.env.IG_PAGE_ACCESS_TOKEN
const API_VERSION = 'v25.0'

const SITE = 'nouvellerive.eu'
// On ne repropose pas une pièce déjà mise en avant depuis moins de 120 jours.
const FEATURE_COOLDOWN_MS = 120 * 24 * 60 * 60 * 1000
const NB_CANDIDATS = 5

export type IgCandidate = {
  productId: string
  sku: string
  nom: string
  marque: string
  prix: number
  imageUrl: string       // fond blanc (photos.face)
  boutiqueUrl: string    // URL produit canonique (slug), pas la redirection /boutique/{id}
}

export type IgWeeklyDoc = {
  weekOf: string
  status: 'pending' | 'chosen' | 'published' | 'skipped'
  candidates: IgCandidate[]
  chosenProductId?: string
  caption?: string
  bioLine?: string
  createdAt?: any
  chosenAt?: any
  publishedAt?: any
  igMediaId?: string
  error?: string
}

// --- Dates (Europe/Paris) ---------------------------------------------------

function parisYMD(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { y: get('year'), m: get('month'), d: get('day') }
}

/**
 * Id du doc hebdo = le mercredi de la semaine courante (aujourd'hui s'il est
 * mercredi, sinon le prochain mercredi). Ancré sur l'heure de Paris.
 * Mardi (génération) et mercredi (publication) tombent sur le même id.
 */
export function upcomingWednesdayId(now = new Date()): string {
  const { y, m, d } = parisYMD(now)
  // Ancre à midi UTC sur la date de Paris → jour de semaine stable (pas de DST).
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const dow = anchor.getUTCDay() // 0=dim … 3=mer
  const delta = (3 - dow + 7) % 7
  anchor.setUTCDate(anchor.getUTCDate() + delta)
  return anchor.toISOString().slice(0, 10)
}

// --- Sélection des candidats ------------------------------------------------

function stripSku(nom: string, sku?: string): string {
  let n = String(nom || '').trim()
  if (sku) n = n.replace(`${sku} - `, '').replace(`${sku} `, '')
  // Filet de sécurité : retire un trigramme + tiret résiduel en tête.
  return n.replace(/^[A-Z]{2,10}\d{0,4}\s*[-–]\s*/, '').trim()
}

function isEligible(raw: any): boolean {
  if (!raw) return false
  if (raw.statut === 'supprime' || raw.statut === 'retour' || raw.statut === 'outOfStock') return false
  if (raw.statutRecuperation) return false
  if (raw.vendu === true) return false
  if ((raw.quantite == null ? 1 : raw.quantite) <= 0) return false
  if (!raw.prix || raw.prix <= 0) return false
  // Fond blanc obligatoire (photos.face = packshot détouré carré).
  if (!raw.photos?.face) return false
  // Cooldown : pas mise en avant récemment.
  const featuredAt = raw.igWeeklyFeaturedAt
  const ms = featuredAt?.toMillis?.() ?? (featuredAt ? new Date(featuredAt).getTime() : 0)
  if (ms && Date.now() - ms < FEATURE_COOLDOWN_MS) return false
  return true
}

function toCandidate(id: string, raw: any): IgCandidate {
  // Lien produit canonique (slug hiérarchique) — pas /boutique/{id} qui n'est
  // qu'une redirection coûtant une lecture Firestore à chaque clic.
  const path = buildProduitPath({
    id,
    nom: raw.nom,
    marque: raw.marque,
    color: raw.color,
    taille: raw.taille,
    categorie: raw.categorie,
  })
  return {
    productId: id,
    sku: raw.sku || '',
    nom: stripSku(raw.nom, raw.sku),
    marque: raw.marque || '',
    prix: typeof raw.prix === 'number' ? raw.prix : 0,
    imageUrl: raw.photos.face,
    boutiqueUrl: `https://${SITE}/${path}`,
  }
}

/** Tire NB_CANDIDATS pièces fond blanc éligibles, mélangées. */
export async function buildCandidates(): Promise<IgCandidate[]> {
  const all = await getAllProduitsCached()
  const eligible = all.filter(({ raw }) => isEligible(raw))
  // Mélange (Fisher–Yates) — variété d'une semaine à l'autre.
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[eligible[i], eligible[j]] = [eligible[j], eligible[i]]
  }
  return eligible.slice(0, NB_CANDIDATS).map(({ id, raw }) => toCandidate(id, raw))
}

// --- Légende & ligne bio par défaut ----------------------------------------

export function defaultCaption(c: IgCandidate): string {
  const titre = [c.marque, c.nom].filter(Boolean).join(' · ')
  return [
    titre,
    c.prix ? `${c.prix}€` : '',
    '',
    c.sku ? `réf ${c.sku}` : '',
    '🔗 week fav en bio pour l\'acheter',
    '',
    '#nouvellerive #secondemain #vintage #upcycling #modecirculaire #paris',
  ]
    .filter((l) => l !== undefined)
    .join('\n')
}

export function defaultBioLine(c: IgCandidate): string {
  const label = [c.marque, c.nom].filter(Boolean).join(' ') || 'la pièce de la semaine'
  return `week fav : ${label}`
}

// --- Publication feed Instagram (Graph API) --------------------------------

/**
 * Tunnel de publication commun (image, reel) : attend que le container soit
 * FINISHED puis appelle media_publish. Renvoie le mediaId.
 * Publier trop tôt → « Media ID is not available », d'où l'attente.
 */
async function finalizePublish(creationId: string, attempts = 12, delayMs = 2000): Promise<string> {
  let statusCode = ''
  for (let i = 0; i < attempts; i++) {
    const statusRes = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${creationId}?fields=status_code&access_token=${IG_TOKEN}`
    )
    const statusData = await statusRes.json()
    statusCode = statusData.status_code || ''
    if (statusCode === 'FINISHED') break
    if (statusCode === 'ERROR') {
      throw new Error(`traitement média échoué: ${JSON.stringify(statusData)}`)
    }
    await new Promise((r) => setTimeout(r, delayMs))
  }
  if (statusCode !== 'FINISHED') {
    throw new Error(`container pas prêt (timeout), status=${statusCode}`)
  }
  const publishRes = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${IG_BUSINESS_ID}/media_publish?creation_id=${creationId}&access_token=${IG_TOKEN}`,
    { method: 'POST' }
  )
  const publishData = await publishRes.json()
  if (!publishData.id) {
    throw new Error(`publication échouée: ${JSON.stringify(publishData)}`)
  }
  return publishData.id as string
}

/**
 * Publie une IMAGE en feed IG avec légende. Même flux que publish-story
 * (container → attente FINISHED → media_publish), sans media_type=STORIES et
 * avec le paramètre caption. Renvoie le mediaId.
 */
export async function publishFeed(imageUrl: string, caption: string): Promise<string> {
  if (!IG_BUSINESS_ID || !IG_TOKEN) {
    throw new Error('Instagram non configuré (env vars manquantes)')
  }
  const containerRes = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${IG_BUSINESS_ID}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: IG_TOKEN }),
    }
  )
  const container = await containerRes.json()
  if (!container.id) {
    throw new Error(`création container échouée: ${JSON.stringify(container)}`)
  }
  return finalizePublish(container.id)
}

/**
 * Publie une VIDÉO en reel IG (partagée au feed, avec le son), légende,
 * vignette (cover) et invités en collaboration. Renvoie le mediaId.
 * La vidéo doit être accessible publiquement (URL Bunny CDN).
 */
export async function publishReel(
  videoUrl: string,
  caption: string,
  opts: { coverUrl?: string; collaborators?: string[] } = {},
): Promise<string> {
  if (!IG_BUSINESS_ID || !IG_TOKEN) {
    throw new Error('Instagram non configuré (env vars manquantes)')
  }

  // 1) Container REELS (partagé au feed) + légende + cover + collaborateurs
  const body: Record<string, any> = {
    media_type: 'REELS',
    video_url: videoUrl,
    caption,
    share_to_feed: true,
    access_token: IG_TOKEN,
  }
  if (opts.coverUrl) body.cover_url = opts.coverUrl
  const collabs = (opts.collaborators || []).map((c) => c.trim().replace(/^@/, '')).filter(Boolean).slice(0, 3)
  if (collabs.length) body.collaborators = collabs

  const containerRes = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${IG_BUSINESS_ID}/media`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )
  const container = await containerRes.json()
  if (!container.id) {
    throw new Error(`création container reel échouée: ${JSON.stringify(container)}`)
  }
  // Même tunnel que l'image, mais plus d'essais (traitement vidéo plus long).
  return finalizePublish(container.id, 20, 2500)
}

// --- Accès au doc hebdo -----------------------------------------------------

export function weeklyRef(weekId: string) {
  return adminDb.collection('igWeekly').doc(weekId)
}

export async function getWeekly(weekId: string): Promise<IgWeeklyDoc | null> {
  const snap = await weeklyRef(weekId).get()
  return snap.exists ? (snap.data() as IgWeeklyDoc) : null
}
