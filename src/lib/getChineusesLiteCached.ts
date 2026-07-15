// lib/getChineusesLiteCached.ts
// Cache Vercel 1h de la liste chineuses (40 docs).
// Mutualisé entre /api/chineuses-lite (ProductGrid client) et produitsServer (SSR pages).
// Un seul scan Firestore de `chineuse` par heure, tout confondu.

import { adminDb } from '@/lib/firebaseAdmin'
import { logFirestoreScan } from '@/lib/logFirestoreScan'
import { getBlobCached } from '@/lib/blobCache'

export type ChineuseLite = {
  uid: string
  slug: string
  trigramme: string
  email: string
  emails: string[]
  videos: string[]
  // Champs additionnels pour SSR fiches produit (privés — ne pas exposer via route publique).
  nom?: string
  accroche?: string
  accrocheEn?: string
  description?: string
  descriptionEn?: string
  texteEcoCirculaire?: number
  stockType?: string
  authUid?: string
  imageUrl?: string
  specialite?: string
  wearType?: string
  ordre?: number
  lien?: string
  instagram?: string
  instagramFeatured?: string
}

// Cache 2-niveaux : mémoire worker + blob Firebase Storage partagé.
const TTL_MS = 6 * 60 * 60 * 1000
const memory: { current: { data: ChineuseLite[]; at: number } | null } = { current: null }
const inflight: { current: Promise<ChineuseLite[]> | null } = { current: null }

async function fetchFresh(): Promise<ChineuseLite[]> {
  const t0 = Date.now()
  const snap = await adminDb.collection('chineuse').get()
  logFirestoreScan('getChineusesLiteCached', snap.docs.length, { elapsedMs: Date.now() - t0 })
  return snap.docs.map(d => {
    const data = d.data() as any
    const videos = Array.isArray(data.videos)
      ? data.videos.filter((u: any) => typeof u === 'string' && /\.mp4(\?|$)/i.test(u))
      : []
    return {
      uid: d.id,
      slug: data.slug || d.id,
      trigramme: (data.trigramme || '').toUpperCase(),
      email: data.email || '',
      emails: Array.isArray(data.emails) ? data.emails : [],
      videos,
      nom: data.nom || '',
      accroche: data.accroche || '',
      accrocheEn: data.accrocheEn || '',
      description: data.description || '',
      descriptionEn: data.descriptionEn || '',
      texteEcoCirculaire: typeof data.texteEcoCirculaire === 'number' ? data.texteEcoCirculaire : 1,
      stockType: data.stockType || 'unique',
      authUid: data.authUid || '',
      imageUrl: data.imageUrl || '',
      specialite: data.specialite || '',
      wearType: data.wearType || 'womenswear',
      ordre: typeof data.ordre === 'number' ? data.ordre : 0,
      lien: data.lien || '',
      instagram: data.instagram || '',
      instagramFeatured: data.instagramFeatured || '',
    }
  })
}

export async function getChineusesLiteCached(): Promise<ChineuseLite[]> {
  return getBlobCached<ChineuseLite[]>('chineuses-lite', TTL_MS, memory, inflight, fetchFresh)
}
