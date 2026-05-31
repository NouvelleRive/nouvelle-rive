import type { MetadataRoute } from 'next'
import { adminDb } from '@/lib/firebaseAdmin'

const BASE_URL = 'https://www.nouvellerive.eu'

const STATIC_PAGES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '/', changeFrequency: 'daily', priority: 1.0 },
  { path: '/new-in', changeFrequency: 'daily', priority: 0.9 },
  { path: '/femme', changeFrequency: 'daily', priority: 0.8 },
  { path: '/homme', changeFrequency: 'daily', priority: 0.8 },
  { path: '/accessoires', changeFrequency: 'daily', priority: 0.8 },
  { path: '/luxe', changeFrequency: 'daily', priority: 0.8 },
  { path: '/les-iconiques', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/iconiques-upcy', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/coups-de-coeur', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/soiree', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/ete', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/nous-rencontrer', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/manifesto', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/nos-creatrices', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/ateliers', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/legal/retours', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/legal/confidentialite', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/legal/mentions-cgv', changeFrequency: 'yearly', priority: 0.2 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map(p => ({
    url: `${BASE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }))

  let productEntries: MetadataRoute.Sitemap = []
  try {
    const snap = await adminDb.collection('produits').get()
    productEntries = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(p =>
        p.statut !== 'supprime' &&
        p.statut !== 'retour' &&
        p.vendu !== true &&
        (p.quantite ?? 1) > 0 &&
        p.prix > 0 &&
        (p.photos?.face || p.imageUrls?.[0] || p.imageUrl)
      )
      .map(p => {
        return {
          url: `${BASE_URL}/boutique/${p.id}`,
          lastModified: now,
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        }
      })
  } catch (err) {
    console.error('[sitemap] Firestore fetch failed:', err)
  }

  return [...staticEntries, ...productEntries]
}
