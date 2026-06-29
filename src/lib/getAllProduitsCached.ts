import { unstable_cache } from 'next/cache'
import { adminDb } from '@/lib/firebaseAdmin'

export const getAllProduitsCached = unstable_cache(
  async () => {
    const snap = await adminDb.collection('produits').get()
    return snap.docs.map(d => ({ id: d.id, raw: d.data() as any }))
  },
  ['all-produits-raw'],
  { revalidate: 600 }
)
