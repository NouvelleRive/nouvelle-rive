import { unstable_cache } from 'next/cache'
import { adminDb } from '@/lib/firebaseAdmin'

export const getAllProduitsCached = unstable_cache(
  async () => {
    const t0 = Date.now()
    const snap = await adminDb.collection('produits').get()
    const count = snap.docs.length
    console.log(`[FS-SCAN] getAllProduitsCached produits=${count} elapsed=${Date.now() - t0}ms`)
    return snap.docs.map(d => ({ id: d.id, raw: d.data() as any }))
  },
  ['all-produits-raw-v2'],
  { revalidate: 21600 }
)
