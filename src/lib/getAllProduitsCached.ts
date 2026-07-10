import { adminDb } from '@/lib/firebaseAdmin'
import { logFirestoreScan } from '@/lib/logFirestoreScan'

// Cache module-scoped (par worker Vercel) — plus fiable que unstable_cache
// qui ne persiste pas correctement entre invocations serverless.
// Chaque worker fait 1 fetch/6h au lieu de 15 fetches/10min observés en prod.
const TTL_MS = 6 * 60 * 60 * 1000

type Cached = { data: Array<{ id: string; raw: any }>; at: number }
let cache: Cached | null = null
let inflight: Promise<Cached['data']> | null = null

async function fetchFresh(): Promise<Cached['data']> {
  const t0 = Date.now()
  const snap = await adminDb.collection('produits').get()
  logFirestoreScan('getAllProduitsCached', snap.docs.length, { elapsedMs: Date.now() - t0 })
  return snap.docs.map(d => ({ id: d.id, raw: d.data() as any }))
}

export async function getAllProduitsCached() {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return cache.data
  // Anti-thundering-herd : si un fetch est déjà en cours, on le partage.
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
