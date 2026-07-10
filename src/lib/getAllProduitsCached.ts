import { unstable_cache } from 'next/cache'
import { adminDb } from '@/lib/firebaseAdmin'
import { logFirestoreScan } from '@/lib/logFirestoreScan'

export const getAllProduitsCached = unstable_cache(
  async () => {
    const t0 = Date.now()
    const snap = await adminDb.collection('produits').get()
    logFirestoreScan('getAllProduitsCached', snap.docs.length, { elapsedMs: Date.now() - t0 })
    return snap.docs.map(d => ({ id: d.id, raw: d.data() as any }))
  },
  ['all-produits-raw-v2'],
  { revalidate: 21600 }
)
