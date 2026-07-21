// Fetch initial server-side d'un lot de produits pour rendre les pages catégorie / home rapides.
// On reste volontairement simple : on prend les N produits récents non vendus, dispos, avec image.
// La logique fine de filtre (siteConfig) reste côté client via useFilteredProducts, qui prendra
// la suite en arrière-plan après le premier paint pour ne pas plomber le LCP.

import { adminDb } from '@/lib/firebaseAdmin'
import { getChineusesLiteCached } from '@/lib/getChineusesLiteCached'
import { getAllProduitsCached } from '@/lib/getAllProduitsCached'
import { getTypeSlug } from '@/lib/produitSlug'

// Copie côté serveur de LUXURY_BRANDS (défini dans lib/admin/helpers.ts) : on ne peut pas importer
// depuis admin/helpers.ts en Server Component car ce fichier tire tout le SDK Firebase client.
const LUXURY_BRANDS = [
  'hermès', 'hermes', 'chanel', 'louis vuitton', 'lv', 'dior', 'christian dior',
  'céline', 'celine', 'yves saint laurent', 'ysl', 'saint laurent', 'gucci',
  'burberry', 'givenchy', 'lanvin', 'nina ricci', 'balenciaga', 'bottega veneta',
  'prada', 'fendi', 'valentino', 'loewe', 'cartier', 'van cleef', 'boucheron',
]

export type ProduitInitial = {
  id: string
  nom: string
  nomEn?: string
  prix: number
  imageUrls: string[]
  imageUrl?: string
  marque?: string
  taille?: string
  color?: string
  material?: string
  modele?: string
  motif?: string
  categorie?: string
  vendu: boolean
  promotion?: boolean
  sku?: string
}

export function toMillis(v: any): number {
  if (!v) return 0
  if (typeof v.toMillis === 'function') return v.toMillis()
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const t = new Date(v).getTime()
    return Number.isFinite(t) ? t : 0
  }
  if (v?.seconds) return v.seconds * 1000
  return 0
}

export function serialize(id: string, raw: any): ProduitInitial {
  return {
    id,
    nom: raw.nom || '',
    nomEn: raw.nomEn,
    prix: typeof raw.prix === 'number' ? raw.prix : 0,
    imageUrls: Array.isArray(raw.imageUrls) ? raw.imageUrls : (raw.imageUrl ? [raw.imageUrl] : []),
    imageUrl: raw.photos?.face || (Array.isArray(raw.imageUrls) ? raw.imageUrls[0] : null) || raw.imageUrl || undefined,
    marque: raw.marque,
    taille: raw.taille,
    color: raw.color,
    material: raw.material,
    modele: raw.modele,
    motif: raw.motif,
    categorie: typeof raw.categorie === 'string' ? raw.categorie : (raw.categorie?.label || ''),
    vendu: !!raw.vendu,
    promotion: !!raw.promotion,
    sku: raw.sku,
  }
}

// Toute la boutique triée par plus récent — sert /boutique ("TOUT VOIR") SSR + API.
// Réutilise getAllProduitsCached (blob 6h + memory + inflight dedupe) : 0 read Firestore
// par visite en régime nominal, ~4 scans/jour tous workers confondus.
export async function getAllBoutiqueProduitsServer(): Promise<ProduitInitial[]> {
  try {
    const all = await getAllProduitsCached()
    const filtered = all
      .filter(({ raw }) =>
        raw.statut !== 'supprime' &&
        raw.statut !== 'retour' &&
        !raw.statutRecuperation &&
        raw.recu !== false &&
        raw.hidden !== true &&
        raw.forceDisplay !== false &&
        raw.vendu !== true &&
        (raw.quantite ?? 1) > 0 &&
        raw.prix > 0 &&
        (raw.photos?.face || raw.imageUrls?.[0] || raw.imageUrl)
      )
      .map(({ id, raw }) => ({ id, raw, ms: toMillis(raw.createdAt) }))
      .sort((a, b) => b.ms - a.ms)
      .map(({ id, raw }) => serialize(id, raw))
    return filtered
  } catch (err) {
    console.error('[produitsServer] getAllBoutiqueProduitsServer error:', err)
    return []
  }
}

export async function getRecentProduitsServer(limit: number = 50): Promise<ProduitInitial[]> {
  try {
    const snap = await adminDb
      .collection('produits')
      .where('vendu', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(limit * 2) // marge pour pouvoir filtrer en mémoire
      .get()

    const filtered = snap.docs
      .map(d => ({ id: d.id, raw: d.data() as any }))
      .filter(({ raw }) =>
        raw.statut !== 'supprime' &&
        raw.statut !== 'retour' &&
        !raw.statutRecuperation &&
        raw.recu !== false &&
        raw.hidden !== true &&
        (raw.quantite ?? 1) > 0 &&
        raw.prix > 0 &&
        (raw.photos?.face || raw.imageUrls?.[0] || raw.imageUrl)
      )
      .slice(0, limit)
      .map(({ id, raw }) => serialize(id, raw))

    return filtered
  } catch (err) {
    console.error('[produitsServer] getRecentProduitsServer error:', err)
    return []
  }
}

// Réplique côté serveur de la logique de matching de siteConfig (lib/siteConfig.ts).
// On garde un sous-ensemble simple : on lit les règles, on prend ~200 produits récents,
// on filtre en mémoire, on renvoie les 50 premiers matches.
type Critere = { type: 'categorie' | 'nom' | 'description' | 'marque' | 'chineuse'; valeur: string }
type Regle = { id: string; criteres: Critere[] }
type PageConfig = { regles: Regle[]; prixMin?: number; prixMax?: number; joursRecents?: number; produitsManquels?: string[] }

function matchCritere(raw: any, c: Critere, chineuses: Map<string, { trigramme?: string; email?: string }>): boolean {
  if (!c.valeur) return true
  const v = c.valeur.toLowerCase()
  switch (c.type) {
    case 'categorie': {
      const cat = typeof raw.categorie === 'object' ? raw.categorie?.label : raw.categorie
      return (cat || '').toLowerCase().includes(v)
    }
    case 'nom':
      return (raw.nom || '').toLowerCase().includes(v)
    case 'description':
      return (raw.description || '').toLowerCase().includes(v)
    case 'marque':
      return (raw.marque || '').toLowerCase().includes(v)
    case 'chineuse': {
      const ch = chineuses.get(c.valeur)
      if (!ch) return false
      const triUp = ch.trigramme?.toUpperCase() || '???'
      const skuUp = (raw.sku || '').toUpperCase()
      const matchSku = skuUp.startsWith(triUp) && (skuUp.length === triUp.length || /\d/.test(skuUp[triUp.length] || ''))
      return raw.chineur === ch.email || raw.chineurUid === c.valeur || matchSku
    }
    default:
      return false
  }
}

export async function getCoupsDeCoeurServer(limit: number = 50): Promise<ProduitInitial[]> {
  try {
    const snap = await adminDb
      .collection('produits')
      .where('likesCount', '>', 0)
      .orderBy('likesCount', 'desc')
      .limit(limit * 2)
      .get()

    const filtered = snap.docs
      .map(d => ({ id: d.id, raw: d.data() as any }))
      .filter(({ raw }) =>
        raw.statut !== 'supprime' &&
        raw.statut !== 'retour' &&
        !raw.statutRecuperation &&
        raw.recu !== false &&
        raw.hidden !== true &&
        raw.forceDisplay !== false &&
        raw.vendu !== true &&
        (raw.quantite ?? 1) > 0 &&
        (raw.imageUrls?.[0] || raw.imageUrl || raw.photos?.face)
      )

    // À nombre de likes identique, on mélange au hasard (Fisher-Yates) plutôt que de garder
    // l'ordre Firestore (createdAt-derived) — la page paraît trop figée sinon.
    const byLikes = new Map<number, Array<{ id: string; raw: any }>>()
    for (const p of filtered) {
      const lc = p.raw.likesCount || 0
      if (!byLikes.has(lc)) byLikes.set(lc, [])
      byLikes.get(lc)!.push(p)
    }
    const shuffled: Array<{ id: string; raw: any }> = []
    for (const lc of [...byLikes.keys()].sort((a, b) => b - a)) {
      const group = byLikes.get(lc)!
      for (let i = group.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[group[i], group[j]] = [group[j], group[i]]
      }
      shuffled.push(...group)
    }

    return shuffled
      .slice(0, limit)
      .map(({ id, raw }) => serialize(id, raw))
  } catch (err) {
    console.error('[produitsServer] getCoupsDeCoeurServer error:', err)
    return []
  }
}

export async function getInitialProduitsForPage(pageId: string, limit: number = 50): Promise<ProduitInitial[]> {
  try {
    const [cfgSnap, prodSnap, chineusesList] = await Promise.all([
      adminDb.collection('siteConfig').doc(pageId).get(),
      adminDb.collection('produits').where('vendu', '==', false).orderBy('createdAt', 'desc').limit(400).get(),
      getChineusesLiteCached(),
    ])

    const config: PageConfig = cfgSnap.exists ? { regles: [], ...(cfgSnap.data() as any) } : { regles: [] }
    const chineuses = new Map<string, { trigramme?: string; email?: string }>()
    chineusesList.forEach(c => {
      chineuses.set(c.uid, { trigramme: c.trigramme, email: c.email })
    })

    const exclus = new Set(config.produitsManquels || [])

    const matches = prodSnap.docs
      .map(d => ({ id: d.id, raw: d.data() as any }))
      .filter(({ id, raw }) => {
        if (exclus.has(id)) return false
        if (raw.statut === 'supprime' || raw.statut === 'retour') return false
        if (raw.statutRecuperation) return false
        if (raw.recu === false || raw.hidden === true) return false
        if ((raw.quantite ?? 1) <= 0) return false
        if (!raw.prix || raw.prix <= 0) return false
        if (!(raw.photos?.face || raw.imageUrls?.[0] || raw.imageUrl)) return false
        if (config.prixMin && raw.prix < config.prixMin) return false
        if (config.prixMax && raw.prix > config.prixMax) return false
        if (config.regles.length === 0) return true
        return config.regles.some(r => r.criteres.length > 0 && r.criteres.every(c => matchCritere(raw, c, chineuses)))
      })
      .slice(0, limit)
      .map(({ id, raw }) => serialize(id, raw))

    return matches
  } catch (err) {
    console.error('[produitsServer] getInitialProduitsForPage error:', err)
    return []
  }
}

// Page /sac : même logique que [type]='sac' (getTypeSlug === 'sac', y compris vendus <3 semaines),
// filtrée en plus par : marque luxe (LUXURY_BRANDS) OU chineuse "petite série" (stockType === 'smallBatch').
export async function getSacsHauteCoutureProduits(): Promise<ProduitInitial[]> {
  try {
    const [all, chineusesList] = await Promise.all([
      getAllProduitsCached(),
      getChineusesLiteCached(),
    ])

    // Chineuses "petite série" — reconnaissables sur uid, email ou trigramme préfixe SKU.
    const smallBatchUids = new Set<string>()
    const smallBatchEmails = new Set<string>()
    const smallBatchTrigrammes = new Set<string>()
    for (const c of chineusesList) {
      if (c.stockType === 'smallBatch') {
        smallBatchUids.add(c.uid)
        if (c.email) smallBatchEmails.add(c.email.toLowerCase())
        if (c.trigramme) smallBatchTrigrammes.add(c.trigramme.toUpperCase())
      }
    }

    // Copie du seuil vendus de [type]/page.tsx.
    const TROIS_SEMAINES_MS = 21 * 24 * 60 * 60 * 1000
    const seuilVendu = Date.now() - TROIS_SEMAINES_MS

    const filtered = all
      .filter(({ raw }) => {
        // ---- reprise EXACTE de [type]/page.tsx filter ----
        if (raw.statut === 'supprime' || raw.statut === 'retour') return false
        if (raw.statutRecuperation) return false
        if (!(raw.prix > 0)) return false
        if (!(raw.photos?.face || raw.imageUrls?.[0] || raw.imageUrl)) return false
        if (getTypeSlug(raw.categorie) !== 'sac') return false
        if (raw.vendu === true) {
          const dv = raw.dateVente
          if (!dv) return false
          const dvMs = typeof dv.toMillis === 'function' ? dv.toMillis() : (typeof dv === 'string' ? new Date(dv).getTime() : (dv?.seconds ? dv.seconds * 1000 : NaN))
          if (!Number.isFinite(dvMs) || dvMs < seuilVendu) return false
        } else if ((raw.quantite ?? 1) <= 0) {
          return false
        }
        // ---- fin reprise ----

        // Condition supplémentaire : marque luxe OU chineuse petite série
        const marqueLower = (raw.marque || '').toLowerCase().trim()
        const matchLuxe = !!marqueLower && LUXURY_BRANDS.some((b) => marqueLower.includes(b) || b.includes(marqueLower))
        if (matchLuxe) return true

        if (raw.chineurUid && smallBatchUids.has(raw.chineurUid)) return true
        if (raw.chineur && smallBatchEmails.has(String(raw.chineur).toLowerCase())) return true
        const sku = (raw.sku || '').toUpperCase()
        if (sku) {
          for (const tri of smallBatchTrigrammes) {
            if (sku.startsWith(tri) && (sku.length === tri.length || /\d/.test(sku[tri.length] || ''))) {
              return true
            }
          }
        }
        return false
      })

    // Tri identique : non-vendus en premier
    filtered.sort((a, b) => Number(!!a.raw.vendu) - Number(!!b.raw.vendu))

    return filtered.map(({ id, raw }) => serialize(id, raw))
  } catch (err) {
    console.error('[produitsServer] getSacsHauteCoutureProduits error:', err)
    return []
  }
}
