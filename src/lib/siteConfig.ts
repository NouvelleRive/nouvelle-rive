// lib/siteConfig.ts
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'

export type PageConfig = {
  chineuses: string[]
  categoriesContient: string[]
  nomContient: string[]
  descriptionContient: string[]
  marques: string[]
  prixMin?: number
  prixMax?: number
  joursRecents?: number
}

export type Produit = {
  id: string
  nom: string
  prix: number
  imageUrls: string[]
  imageUrl?: string
  categorie: any
  marque?: string
  taille?: string
  vendu: boolean
  chineur?: string
  createdAt?: any
}

/**
 * Charge les produits filtrés selon la config d'une page
 */
export async function getFilteredProducts(pageId: string): Promise<Produit[]> {
  // 1. Charger la config
  const configRef = doc(db, 'siteConfig', pageId)
  const configSnap = await getDoc(configRef)
  const config: PageConfig = configSnap.exists() 
    ? { chineuses: [], categoriesContient: [], nomContient: [], descriptionContient: [], marques: [], ...configSnap.data() }
    : { chineuses: [], categoriesContient: [], nomContient: [], descriptionContient: [], marques: [] }

  // 2. Charger tous les produits non vendus
  const q = query(
    collection(db, 'produits'),
    where('vendu', '==', false)
  )
  const snapshot = await getDocs(q)
  let produits = snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  })) as Produit[]

  // 3. Appliquer les filtres
  produits = produits.filter(p => {
    // Filtre chineuses
    if (config.chineuses.length > 0) {
      const chineurMatch = config.chineuses.some(ch => 
        (p.chineur || '').toLowerCase().includes(ch.toLowerCase())
      )
      if (!chineurMatch) return false
    }

    // Filtre catégories (contient)
    if (config.categoriesContient.length > 0) {
      const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
      const catMatch = config.categoriesContient.some(c => 
        (cat || '').toLowerCase().includes(c.toLowerCase())
      )
      if (!catMatch) return false
    }

    // Filtre nom (contient)
    if (config.nomContient.length > 0) {
      const nomMatch = config.nomContient.some(n => 
        (p.nom || '').toLowerCase().includes(n.toLowerCase())
      )
      if (!nomMatch) return false
    }

    // Filtre description (contient)
    if (config.descriptionContient.length > 0) {
      const descMatch = config.descriptionContient.some(d => 
        ((p as any).description || '').toLowerCase().includes(d.toLowerCase())
      )
      if (!descMatch) return false
    }

    // Filtre marques
    if (config.marques.length > 0) {
      const marqueMatch = config.marques.some(m => 
        (p.marque || '').toLowerCase().includes(m.toLowerCase())
      )
      if (!marqueMatch) return false
    }

    // Filtre prix min
    if (config.prixMin && p.prix < config.prixMin) return false

    // Filtre prix max
    if (config.prixMax && p.prix > config.prixMax) return false

    // Filtre jours récents
    if (config.joursRecents && p.createdAt) {
      const createdDate = p.createdAt instanceof Timestamp 
        ? p.createdAt.toDate() 
        : new Date(p.createdAt)
      const daysAgo = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      if (daysAgo > config.joursRecents) return false
    }

    // Filtre : doit avoir une image
    const hasImage = (p.imageUrls && p.imageUrls.length > 0) || p.imageUrl
    if (!hasImage) return false

    return true
  })

  return produits
}