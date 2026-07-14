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

export const revalidate = 3600

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

  let productPaths: string[] = []
  let types: string[] = []
  let luxuryBrands: string[] = []
  let usedCache = false

  try {
    const cacheDoc = await adminDb.doc('_meta/sitemap-cache').get()
    const data = cacheDoc.data()
    if (data && Array.isArray(data.paths) && data.paths.length > 0) {
      productPaths = data.paths
      types = Array.isArray(data.types) ? data.types : []
      luxuryBrands = Array.isArray(data.luxuryBrands) ? data.luxuryBrands : []
      usedCache = true
    }
  } catch (err) {
    console.error('[sitemap] cache read failed:', err)
  }

  if (!usedCache) {
    // Fallback : première exécution avant que la Firebase Function `regenSitemapCache` ait tourné.
    try {
      const snap = await adminDb.collection('produits')
        .select('statut', 'vendu', 'quantite', 'prix', 'photos', 'imageUrls', 'imageUrl', 'marque', 'categorie', 'nom', 'color', 'taille')
        .get()
      const typeSet = new Set<string>()
      const luxSet = new Set<string>()
      for (const doc of snap.docs) {
        const p = { id: doc.id, ...doc.data() } as any
        if (p.statut === 'supprime' || p.statut === 'retour') continue
        if (p.vendu === true) continue
        if ((p.quantite ?? 1) <= 0) continue
        if (!p.prix || p.prix <= 0) continue
        if (!p.photos?.face && !p.imageUrls?.[0] && !p.imageUrl) continue
        const type = getTypeSlug(p.categorie)
        if (type && type !== 'piece') typeSet.add(type)
        if (p.marque) {
          const bSlug = slugifyBrandStr(p.marque)
          if (LUXURY_SLUGS.has(bSlug)) luxSet.add(bSlug)
        }
        productPaths.push(buildProduitPath(p))
      }
      types = Array.from(typeSet)
      luxuryBrands = Array.from(luxSet)
    } catch (err) {
      console.error('[sitemap] fallback Firestore fetch failed:', err)
    }
  }

  const typeEntries: MetadataRoute.Sitemap = types.map(type => ({
    url: `${BASE_URL}/${type}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }))

  const brandEntries: MetadataRoute.Sitemap = luxuryBrands.map(slug => ({
    url: `${BASE_URL}/designer/${slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }))

  const productEntries: MetadataRoute.Sitemap = productPaths.map(path => ({
    url: `${BASE_URL}/${path}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const seen = new Set<string>()
  return [...staticEntries, ...typeEntries, ...brandEntries, ...productEntries]
    .filter(e => {
      if (seen.has(e.url)) return false
      seen.add(e.url)
      return true
    })
}
