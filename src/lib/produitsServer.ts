// Fetch initial server-side d'un lot de produits pour rendre les pages catégorie / home rapides.
// On reste volontairement simple : on prend les N produits récents non vendus, dispos, avec image.
// La logique fine de filtre (siteConfig) reste côté client via useFilteredProducts, qui prendra
// la suite en arrière-plan après le premier paint pour ne pas plomber le LCP.

import { adminDb } from '@/lib/firebaseAdmin'

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
