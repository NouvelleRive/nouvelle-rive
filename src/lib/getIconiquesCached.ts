// lib/getIconiquesCached.ts
// Cache module-scoped (par worker Vercel) de la collection iconiques (~24 docs).

import { adminDb } from '@/lib/firebaseAdmin'
import { logFirestoreScan } from '@/lib/logFirestoreScan'

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
  ordre?: number
  soldOut?: boolean
  buyLink?: string
  videos?: string[]
  videosLabel?: string
  videosLabelEn?: string
}

const TTL_MS = 6 * 60 * 60 * 1000
type Cached = { data: IconiqueDoc[]; at: number }
let cache: Cached | null = null
let inflight: Promise<IconiqueDoc[]> | null = null

async function fetchFresh(): Promise<IconiqueDoc[]> {
  const t0 = Date.now()
  const snap = await adminDb.collection('iconiques').get()
  logFirestoreScan('getIconiquesCached', snap.docs.length, { elapsedMs: Date.now() - t0 })
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
}

export async function getIconiquesCached(): Promise<IconiqueDoc[]> {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return cache.data
  if (inflight) return inflight
  inflight = fetchFresh()
    .then(data => {
      cache = { data, at: Date.now() }
      return data
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}
