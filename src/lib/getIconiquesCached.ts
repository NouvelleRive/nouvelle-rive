// lib/getIconiquesCached.ts
// Cache Vercel 6h de la collection iconiques (~24 docs).
// Évite un getDocs Firestore côté client à chaque montage de la page /iconiques ou /upcy.

import { unstable_cache } from 'next/cache'
import { adminDb } from '@/lib/firebaseAdmin'

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

export const getIconiquesCached = unstable_cache(
  async (): Promise<IconiqueDoc[]> => {
    const t0 = Date.now()
    const snap = await adminDb.collection('iconiques').get()
    const count = snap.docs.length
    console.log(`[FS-SCAN] getIconiquesCached iconiques=${count} elapsed=${Date.now() - t0}ms`)
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
  },
  ['iconiques-v1'],
  { revalidate: 21600 },
)
