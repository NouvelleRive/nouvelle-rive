// lib/getNavPagesCached.ts
// Cache 2-niveaux (mémoire worker + blob Firebase Storage) de la config nav publique
// (doc siteConfig/_nav édité via /admin/site NavManager). Fallback statique SITE_PAGES
// si le doc n'existe pas encore (jamais sauvegardé).

import { adminDb } from '@/lib/firebaseAdmin'
import { getBlobCached } from '@/lib/blobCache'
import { seedNavFromStatic, type NavPage } from '@/lib/nav-config'

const TTL_MS = 6 * 60 * 60 * 1000
const memory: { current: { data: NavPage[]; at: number } | null } = { current: null }
const inflight: { current: Promise<NavPage[]> | null } = { current: null }

async function fetchFresh(): Promise<NavPage[]> {
  try {
    const snap = await adminDb.collection('siteConfig').doc('_nav').get()
    if (snap.exists) {
      const data = snap.data() as any
      if (Array.isArray(data?.pages)) return data.pages as NavPage[]
    }
  } catch {
    /* fallback ci-dessous */
  }
  return seedNavFromStatic()
}

export async function getNavPagesCached(): Promise<NavPage[]> {
  return getBlobCached<NavPage[]>('nav-config', TTL_MS, memory, inflight, fetchFresh)
}

/** Reset des caches L1/L2 — appelé quand /api/nav-config POST vient de sauvegarder. */
export function resetNavPagesMemoryCache(): void {
  memory.current = null
  inflight.current = null
}
