import { adminDb } from '@/lib/firebaseAdmin'
import { logFirestoreScan } from '@/lib/logFirestoreScan'
import { getBlobCached } from '@/lib/blobCache'

// Cache 2-niveaux : mémoire worker + blob Firebase Storage partagé entre workers.
// Objectif : que la collection produits (5000+ docs) soit scannée AU PLUS 4×/jour
// tous workers confondus (au lieu de 132× observé en prod avec unstable_cache).

const TTL_MS = 6 * 60 * 60 * 1000
// Le cache mémoire expire vite pour qu'un worker voie un blob patché (fiche
// modifiée en admin) rapidement. Un refresh L1 = 1 download blob, 0 read Firestore.
const MEM_TTL_MS = 60 * 1000

type Item = { id: string; raw: any }
const memory: { current: { data: Item[]; at: number } | null } = { current: null }
const inflight: { current: Promise<Item[]> | null } = { current: null }

async function fetchFresh(): Promise<Item[]> {
  const t0 = Date.now()
  const snap = await adminDb.collection('produits').get()
  logFirestoreScan('getAllProduitsCached', snap.docs.length, { elapsedMs: Date.now() - t0 })
  return snap.docs.map(d => ({ id: d.id, raw: d.data() as any }))
}

export async function getAllProduitsCached(): Promise<Item[]> {
  return getBlobCached<Item[]>('produits-all', TTL_MS, memory, inflight, fetchFresh, MEM_TTL_MS)
}
