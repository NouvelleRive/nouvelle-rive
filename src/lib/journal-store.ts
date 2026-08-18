// src/lib/journal-store.ts — source de vérité du Journal (Firestore + cache).
// Doc unique : siteConfig/_journal = { articles: StoredArticle[] }.
// Lecture publique via cache 2-niveaux (mémoire worker + blob) → ~0 read facturé.
// Écriture (admin) : lit le doc frais, patche, réécrit, invalide le cache.

import { adminDb, adminStorage } from '@/lib/firebaseAdmin'
import { getBlobCached } from '@/lib/blobCache'
import { seedStoredArticles, type StoredArticle } from '@/lib/journal-articles'

const DOC_PATH = 'siteConfig/_journal'
const TTL_MS = 6 * 60 * 60 * 1000
const memory: { current: { data: StoredArticle[]; at: number } | null } = { current: null }
const inflight: { current: Promise<StoredArticle[]> | null } = { current: null }

/** Champs éditables autorisés côté admin. */
export type ArticlePatch = Partial<
  Pick<
    StoredArticle,
    'title' | 'description' | 'category' | 'date' | 'readingMinutes' | 'cover' | 'body' | 'relu' | 'published'
  >
> & { cta?: { href: string; label: string } | null }

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** En ligne = relu ET armé ET date atteinte. */
export function isArticleLive(a: StoredArticle, today = todayISO()): boolean {
  return !!a.relu && !!a.published && a.date <= today
}

async function fetchFresh(): Promise<StoredArticle[]> {
  const snap = await adminDb.doc(DOC_PATH).get()
  const data = snap.data()
  if (snap.exists && Array.isArray(data?.articles) && data.articles.length > 0) {
    return data.articles as StoredArticle[]
  }
  // Première fois : on sème le doc à partir du code.
  const seed = seedStoredArticles()
  try {
    await adminDb.doc(DOC_PATH).set({ articles: seed })
  } catch {
    /* si l'écriture échoue on renvoie quand même la graine */
  }
  return seed
}

/** Tous les articles (cachés), dans l'ordre du doc. */
export async function getAllArticlesCached(): Promise<StoredArticle[]> {
  return getBlobCached<StoredArticle[]>('journal', TTL_MS, memory, inflight, fetchFresh)
}

/** Articles réellement en ligne, triés du plus récent au plus ancien. */
export async function getLiveArticles(): Promise<StoredArticle[]> {
  const today = todayISO()
  return (await getAllArticlesCached())
    .filter(a => isArticleLive(a, today))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/** Un article par slug, même non publié (pour l'aperçu). */
export async function getStoredArticle(slug: string): Promise<StoredArticle | undefined> {
  return (await getAllArticlesCached()).find(a => a.slug === slug)
}

async function resetCache(): Promise<void> {
  memory.current = null
  inflight.current = null
  // Supprime le blob L2 pour que les autres workers repartent du frais Firestore.
  try {
    const file = adminStorage.bucket().file('_cache/journal.json.gz')
    const [exists] = await file.exists()
    if (exists) await file.delete()
  } catch {
    /* pas grave : le TTL finira par régénérer le blob */
  }
}

/** Lecture fraîche (sans cache) pour les écritures. */
async function readFresh(): Promise<StoredArticle[]> {
  const snap = await adminDb.doc(DOC_PATH).get()
  const data = snap.data()
  if (snap.exists && Array.isArray(data?.articles) && data.articles.length > 0) {
    return data.articles as StoredArticle[]
  }
  const seed = seedStoredArticles()
  await adminDb.doc(DOC_PATH).set({ articles: seed })
  return seed
}

function slugify(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Crée un nouvel article (brouillon) à partir d'un titre. Renvoie l'article créé. */
export async function createArticle(title: string): Promise<StoredArticle> {
  const articles = await readFresh()
  const base = slugify(title) || 'nouvel-article'
  let slug = base
  let n = 2
  while (articles.some(a => a.slug === slug)) slug = `${base}-${n++}`

  const today = todayISO()
  const article: StoredArticle = {
    slug,
    title: title.trim() || 'Nouvel article',
    description: '',
    category: 'GUIDE',
    date: today,
    readingMinutes: 3,
    body: '',
    relu: false,
    published: false,
  }
  articles.unshift(article)
  await adminDb.doc(DOC_PATH).set({ articles })
  await resetCache()
  return article
}

/**
 * Patche un article et réécrit le doc.
 * Règle métier : impossible de passer `published: true` si l'article n'est pas relu.
 * Renvoie l'article mis à jour, ou lève si le slug est introuvable.
 */
export async function saveArticle(slug: string, patch: ArticlePatch): Promise<StoredArticle> {
  const articles = await readFresh()
  const idx = articles.findIndex(a => a.slug === slug)
  if (idx === -1) throw new Error(`Article introuvable : ${slug}`)

  const current = articles[idx]
  const next: StoredArticle = { ...current }

  if (patch.title !== undefined) next.title = patch.title
  if (patch.description !== undefined) next.description = patch.description
  if (patch.category !== undefined) next.category = patch.category
  if (patch.date !== undefined) next.date = patch.date
  if (patch.readingMinutes !== undefined) next.readingMinutes = Number(patch.readingMinutes) || 1
  if (patch.cover !== undefined) next.cover = patch.cover || undefined
  if (patch.body !== undefined) next.body = patch.body
  if (patch.cta !== undefined) next.cta = patch.cta || undefined
  if (patch.relu !== undefined) next.relu = !!patch.relu
  if (patch.published !== undefined) next.published = !!patch.published

  // Garde-fou : un article non relu ne peut pas être publié.
  if (next.published && !next.relu) {
    next.published = false
  }

  articles[idx] = next
  await adminDb.doc(DOC_PATH).set({ articles })
  await resetCache()
  return next
}
