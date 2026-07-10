// lib/getChineusesFullCached.ts
// Cache Vercel 1h de la liste chineuses AVEC champs privés (bancaires, taux).
// Réservé aux routes admin. Séparé de getChineusesLiteCached pour éviter
// d'exposer iban/bic/raisonSociale si le cache lite est un jour ouvert au public.

import { unstable_cache } from 'next/cache'
import { adminDb } from '@/lib/firebaseAdmin'

export type ChineuseFull = {
  uid: string
  slug: string
  trigramme: string
  email: string
  emails: string[]
  nom: string
  raisonSociale?: string
  iban?: string
  bic?: string
  taux?: number
  stockType?: string
  authUid?: string
  ordre?: number
}

export const getChineusesFullCached = unstable_cache(
  async (): Promise<ChineuseFull[]> => {
    const t0 = Date.now()
    const snap = await adminDb.collection('chineuse').get()
    console.log(`[FS-SCAN] getChineusesFullCached chineuse=${snap.docs.length} elapsed=${Date.now() - t0}ms`)
    return snap.docs.map(d => {
      const data = d.data() as any
      return {
        uid: d.id,
        slug: data.slug || d.id,
        trigramme: (data.trigramme || '').toUpperCase(),
        email: data.email || '',
        emails: Array.isArray(data.emails) ? data.emails : [],
        nom: data.nom || '',
        raisonSociale: data.raisonSociale || '',
        iban: data.iban || '',
        bic: data.bic || '',
        taux: typeof data.taux === 'number' ? data.taux : undefined,
        stockType: data.stockType || 'unique',
        authUid: data.authUid || '',
        ordre: typeof data.ordre === 'number' ? data.ordre : 0,
      }
    })
  },
  ['chineuses-full-admin-v1'],
  { revalidate: 3600 }
)
