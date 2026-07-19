// lib/getIconiquesCached.ts
// Cache 2-niveaux (mémoire worker + blob Firebase Storage) de la collection
// iconiques (~24 docs).

import { adminDb } from '@/lib/firebaseAdmin'
import { logFirestoreScan } from '@/lib/logFirestoreScan'
import { getBlobCached } from '@/lib/blobCache'

export type IconiqueDoc = {
  id: string
  displayOnWebsite?: boolean
  type?: string
  nom?: string
  nomEn?: string
  slug?: string
  dateCreation?: string
  histoire?: string
  histoireEn?: string
  valeurNeuf?: number
  tendancePrix?: 'monte' | 'descend'
  pourquoiMust?: string
  pourquoiMustEn?: string
  categorieRecherche?: string
  marque?: string
  chineuseTrigrammes?: string[]
  categoriesIn?: string[]
  categoriesOrder?: string[]
  materialContient?: string
  nomPluriel?: string
  nomPlurielEn?: string
  images?: string[]
  /** Cadrage par photo (zoom + focus), aligné index par index sur `images`. */
  imageTransforms?: { scale: number; x: number; y: number }[]
  ordre?: number
  soldOut?: boolean
  buyLink?: string
  videos?: string[]
  videosLabel?: string
  videosLabelEn?: string
}

const TTL_MS = 6 * 60 * 60 * 1000
// Idem produits : mémoire courte pour qu'un worker voie un blob rafraîchi
// (nouvel iconique) sans attendre 6h. Un refresh L1 = 1 download, 0 read Firestore.
const MEM_TTL_MS = 60 * 1000
const memory: { current: { data: IconiqueDoc[]; at: number } | null } = { current: null }
const inflight: { current: Promise<IconiqueDoc[]> | null } = { current: null }

async function fetchFresh(): Promise<IconiqueDoc[]> {
  const t0 = Date.now()
  const snap = await adminDb.collection('iconiques').get()
  logFirestoreScan('getIconiquesCached', snap.docs.length, { elapsedMs: Date.now() - t0 })
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
}

export async function getIconiquesCached(): Promise<IconiqueDoc[]> {
  return getBlobCached<IconiqueDoc[]>('iconiques', TTL_MS, memory, inflight, fetchFresh, MEM_TTL_MS)
}
