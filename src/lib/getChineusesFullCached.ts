// lib/getChineusesFullCached.ts
// Cache module-scoped (par worker Vercel) de la liste chineuses AVEC champs
// privés (bancaires, taux). Réservé aux routes admin.

import { adminDb } from '@/lib/firebaseAdmin'
import { logFirestoreScan } from '@/lib/logFirestoreScan'

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

const TTL_MS = 6 * 60 * 60 * 1000
type Cached = { data: ChineuseFull[]; at: number }
let cache: Cached | null = null
let inflight: Promise<ChineuseFull[]> | null = null

async function fetchFresh(): Promise<ChineuseFull[]> {
  const t0 = Date.now()
  const snap = await adminDb.collection('chineuse').get()
  logFirestoreScan('getChineusesFullCached', snap.docs.length, { elapsedMs: Date.now() - t0 })
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
}

export async function getChineusesFullCached(): Promise<ChineuseFull[]> {
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
