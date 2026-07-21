// lib/getPageProduitsCached.ts
// Cache Vercel 6h de la liste des produits filtrés par pageId (matching siteConfig).
// Utilisé par la route /api/page-produits — remplace la logique client de
// useFilteredProducts qui scannait TOUTE la collection produits + chineuses par visite.

import { unstable_cache } from 'next/cache'
import { adminDb } from '@/lib/firebaseAdmin'
import { getAllProduitsCached } from '@/lib/getAllProduitsCached'
import { getChineusesLiteCached } from '@/lib/getChineusesLiteCached'

// Copie serveur de LUXURY_BRANDS (défini dans lib/admin/helpers.ts) : ce fichier tire
// le SDK Firebase client, donc pas importable depuis un Server Component / route API.
const LUXURY_BRANDS = [
  'hermès', 'hermes', 'chanel', 'louis vuitton', 'lv', 'dior', 'christian dior',
  'céline', 'celine', 'yves saint laurent', 'ysl', 'saint laurent', 'gucci',
  'burberry', 'givenchy', 'lanvin', 'nina ricci', 'balenciaga', 'bottega veneta',
  'prada', 'fendi', 'valentino', 'loewe', 'cartier', 'van cleef', 'boucheron',
]

type Critere = {
  type: 'categorie' | 'nom' | 'description' | 'marque' | 'chineuse'
  valeur: string
}
type Regle = { id: string; criteres: Critere[] }
type PageConfig = {
  regles: Regle[]
  prixMin?: number
  prixMax?: number
  joursRecents?: number
  produitsManquels?: string[]
}

function matchCritere(
  p: any,
  c: Critere,
  chineusesByUid: Map<string, { trigramme?: string; email?: string }>,
): boolean {
  if (!c.valeur) return true
  const v = c.valeur.toLowerCase()
  switch (c.type) {
    case 'categorie': {
      const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
      return (cat || '').toLowerCase().includes(v)
    }
    case 'nom':
      return (p.nom || '').toLowerCase().includes(v)
    case 'description':
      return (p.description || '').toLowerCase().includes(v)
    case 'marque': {
      const marque = (p.marque || '').toLowerCase().trim()
      // Special : valeur "luxe" matche toutes les marques dans LUXURY_BRANDS
      // (comme dans /api/iconique-produits, pour que les rules de /sac, /luxe, etc.
      // n'aient pas à énumérer les ~25 marques luxe manuellement).
      if (v === 'luxe') {
        if (!marque) return false
        return LUXURY_BRANDS.some(b => marque.includes(b) || b.includes(marque))
      }
      return marque.includes(v)
    }
    case 'chineuse': {
      const ch = chineusesByUid.get(c.valeur)
      if (!ch) return false
      const triUp = (ch.trigramme || '').toUpperCase()
      const skuUp = (p.sku || '').toUpperCase()
      const matchSku =
        triUp &&
        skuUp.startsWith(triUp) &&
        (skuUp.length === triUp.length || /\d/.test(skuUp[triUp.length] || ''))
      return p.chineur === ch.email || p.chineurUid === c.valeur || !!matchSku
    }
    default:
      return false
  }
}

function toMillis(v: any): number | null {
  if (!v) return null
  if (typeof v.toMillis === 'function') return v.toMillis()
  if (typeof v === 'string') {
    const t = new Date(v).getTime()
    return Number.isFinite(t) ? t : null
  }
  if (typeof v === 'number') return v
  if (v?.seconds) return v.seconds * 1000
  return null
}

async function fetchPageConfig(pageId: string): Promise<PageConfig> {
  try {
    const snap = await adminDb.collection('siteConfig').doc(pageId).get()
    return snap.exists ? { regles: [], ...(snap.data() as any) } : { regles: [] }
  } catch {
    return { regles: [] }
  }
}

// Cache la config Firestore de la page séparément (pageId dans la clé) — 1 read
// toutes les 6h par pageId, aucun read Firestore ensuite. Le tag `site-config-<pageId>`
// permet à /api/site-config POST de revalider ce cache immédiatement après une save admin.
const getPageConfigCached = (pageId: string) =>
  unstable_cache(
    async () => fetchPageConfig(pageId),
    ['site-config', pageId],
    { revalidate: 21600, tags: [`site-config-${pageId}`] },
  )()

export async function getPageProduits(pageId: string) {
  const [config, allProduits, chineuses] = await Promise.all([
    getPageConfigCached(pageId),
    getAllProduitsCached(),
    getChineusesLiteCached(),
  ])

  const chineusesByUid = new Map<string, { trigramme?: string; email?: string }>()
  chineuses.forEach(c => chineusesByUid.set(c.uid, { trigramme: c.trigramme, email: c.email }))

  const exclus = new Set(config.produitsManquels || [])
  const troisSemainesMs = 21 * 24 * 60 * 60 * 1000
  const now = Date.now()

  const filtered = allProduits
    .map(({ id, raw }) => ({ id, ...raw } as any))
    .filter(p => {
      if (exclus.has(p.id)) return false
      if (p.statut === 'retour' || p.statut === 'supprime') return false
      if (p.statutRecuperation) return false
      if (p.recu === false) return false
      if (p.hidden === true) return false
      if (p.forceDisplay === false) return false
      const hasImage =
        (Array.isArray(p.imageUrls) && p.imageUrls.length > 0) ||
        p.imageUrl ||
        p.photos?.face
      if (!hasImage) return false
      if (config.prixMin && p.prix < config.prixMin) return false
      if (config.prixMax && p.prix > config.prixMax) return false

      if (p.vendu === true) {
        // Garder les vendus depuis < 3 semaines (badge "Vendu" côté UI).
        const dvMs = toMillis(p.dateVente)
        if (!dvMs || now - dvMs > troisSemainesMs) return false
      } else {
        const quantite = p.quantite ?? 1
        if (quantite <= 0) return false
      }

      if (config.joursRecents) {
        const createdMs = toMillis(p.createdAt)
        if (createdMs) {
          const daysAgo = (now - createdMs) / (1000 * 60 * 60 * 24)
          if (daysAgo > config.joursRecents) return false
        }
      }

      if (config.regles.length === 0) return true
      return config.regles.some(
        r => r.criteres.length > 0 && r.criteres.every(c => matchCritere(p, c, chineusesByUid)),
      )
    })

  // Tri : likes desc, puis photo portée, puis date création desc.
  filtered.sort((a, b) => {
    const likesA = a.likesCount || 0
    const likesB = b.likesCount || 0
    if (likesB !== likesA) return likesB - likesA

    const wornA = !!(a.photos?.faceOnModel || a.photos?.dosOnModel)
    const wornB = !!(b.photos?.faceOnModel || b.photos?.dosOnModel)
    if (wornA !== wornB) return wornB ? 1 : -1

    const msA = toMillis(a.createdAt) || 0
    const msB = toMillis(b.createdAt) || 0
    return msB - msA
  })

  // On sérialise en objet plain pour éviter les Timestamp non-JSON-safe.
  return filtered.map(p => ({
    ...p,
    createdAt: toMillis(p.createdAt),
    dateVente: toMillis(p.dateVente),
  }))
}
