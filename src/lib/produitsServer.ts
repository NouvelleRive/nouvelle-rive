// Fetch initial server-side d'un lot de produits pour rendre les pages catégorie / home rapides.
// On reste volontairement simple : on prend les N produits récents non vendus, dispos, avec image.
// La logique fine de filtre (siteConfig) reste côté client via useFilteredProducts, qui prendra
// la suite en arrière-plan après le premier paint pour ne pas plomber le LCP.

import { adminDb } from '@/lib/firebaseAdmin'
import { getChineusesLiteCached } from '@/lib/getChineusesLiteCached'
import { getTypeSlug } from '@/lib/produitSlug'

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

function serialize(id: string, raw: any): ProduitInitial {
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

    return snap.docs
      .map(d => ({ id: d.id, raw: d.data() as any }))
      .filter(({ raw }) =>
        raw.statut !== 'supprime' &&
        raw.statut !== 'retour' &&
        raw.recu !== false &&
        raw.hidden !== true &&
        raw.forceDisplay !== false &&
        raw.vendu !== true &&
        (raw.quantite ?? 1) > 0 &&
        (raw.imageUrls?.[0] || raw.imageUrl || raw.photos?.face)
      )
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

// Page /sac : sacs qui matchent les règles LUXE (siteConfig/luxe) OU qui viennent d'une chineuse
// "petite série" (stockType === 'smallBatch'). Filtre supplémentaire : categorie doit être "sac".
export async function getSacsHauteCoutureProduits(limit: number = 50): Promise<ProduitInitial[]> {
  try {
    const [cfgSnap, prodSnap, chineusesList] = await Promise.all([
      adminDb.collection('siteConfig').doc('luxe').get(),
      adminDb.collection('produits').where('vendu', '==', false).orderBy('createdAt', 'desc').limit(600).get(),
      getChineusesLiteCached(),
    ])

    const luxeCfg: PageConfig = cfgSnap.exists ? { regles: [], ...(cfgSnap.data() as any) } : { regles: [] }

    const chineusesMap = new Map<string, { trigramme?: string; email?: string }>()
    chineusesList.forEach((c) => chineusesMap.set(c.uid, { trigramme: c.trigramme, email: c.email }))

    // Identifiants de reconnaissance des chineuses "petite série" — on matche sur uid, email ou
    // trigramme préfixe SKU (même règle que matchCritere case 'chineuse').
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

    const exclus = new Set(luxeCfg.produitsManquels || [])

    const matches = prodSnap.docs
      .map((d) => ({ id: d.id, raw: d.data() as any }))
      .filter(({ id, raw }) => {
        if (raw.statut === 'supprime' || raw.statut === 'retour') return false
        if (raw.recu === false || raw.hidden === true) return false
        if ((raw.quantite ?? 1) <= 0) return false
        if (!raw.prix || raw.prix <= 0) return false
        if (!(raw.photos?.face || raw.imageUrls?.[0] || raw.imageUrl)) return false

        // Restriction sac uniquement.
        if (getTypeSlug(raw.categorie) !== 'sac') return false

        // Union : match règles LUXE OU chineuse petite série.
        const matchLuxe = (() => {
          if (exclus.has(id)) return false
          if (luxeCfg.prixMin && raw.prix < luxeCfg.prixMin) return false
          if (luxeCfg.prixMax && raw.prix > luxeCfg.prixMax) return false
          if (luxeCfg.regles.length === 0) return true
          return luxeCfg.regles.some(
            (r) => r.criteres.length > 0 && r.criteres.every((c) => matchCritere(raw, c, chineusesMap))
          )
        })()

        if (matchLuxe) return true

        // smallBatch : uid, email, ou trigramme préfixe SKU
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
      .slice(0, limit)
      .map(({ id, raw }) => serialize(id, raw))

    return matches
  } catch (err) {
    console.error('[produitsServer] getSacsHauteCoutureProduits error:', err)
    return []
  }
}
