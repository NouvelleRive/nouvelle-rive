import type { MetadataRoute } from 'next'
import { adminDb } from '@/lib/firebaseAdmin'
import { buildProduitPath, getTypeSlug } from '@/lib/produitSlug'
import { LUXURY_BRANDS } from '@/lib/admin/helpers'

const DIACRITICS = /[̀-ͯ]/g
function slugifyBrandStr(s: string): string {
  return (s || '').normalize('NFD').replace(DIACRITICS, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
const LUXURY_SLUGS = new Set(LUXURY_BRANDS.map(slugifyBrandStr))

const BASE_URL = 'https://www.nouvellerive.eu'

const STATIC_PAGES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '/', changeFrequency: 'daily', priority: 1.0 },
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
  const typeSet = new Set<string>()
  const luxuryBrandSet = new Set<string>()
  try {
    const snap = await adminDb.collection('produits').get()
    const available = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(p =>
        p.statut !== 'supprime' &&
        p.statut !== 'retour' &&
        p.vendu !== true &&
        (p.quantite ?? 1) > 0 &&
        p.prix > 0 &&
        (p.photos?.face || p.imageUrls?.[0] || p.imageUrl)
      )
    productEntries = available.map(p => {
      const type = getTypeSlug(p.categorie)
      if (type && type !== 'piece') typeSet.add(type)
      if (p.marque) {
        const bSlug = slugifyBrandStr(p.marque)
        if (LUXURY_SLUGS.has(bSlug)) luxuryBrandSet.add(bSlug)
      }
      return {
        url: `${BASE_URL}/${buildProduitPath(p)}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }
    })
  } catch (err) {
    console.error('[sitemap] Firestore fetch failed:', err)
  }

  const typeEntries: MetadataRoute.Sitemap = Array.from(typeSet).map(type => ({
    url: `${BASE_URL}/${type}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }))

  const brandEntries: MetadataRoute.Sitemap = Array.from(luxuryBrandSet).map(slug => ({
    url: `${BASE_URL}/designer/${slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }))

  return [...staticEntries, ...typeEntries, ...brandEntries, ...productEntries]
}
