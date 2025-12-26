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
  logique: 'ET' | 'OU'
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
  description?: string
}

/**
 * Charge les produits filtrés selon la config d'une page
 */
export async function getFilteredProducts(pageId: string): Promise<Produit[]> {
  // 1. Charger la config
  const configRef = doc(db, 'siteConfig', pageId)
  const configSnap = await getDoc(configRef)
  const config: PageConfig = configSnap.exists() 
    ? { 
        chineuses: [], 
        categoriesContient: [], 
        nomContient: [], 
        descriptionContient: [], 
        marques: [], 
        logique: 'OU',
        ...configSnap.data() 
      }
    : { 
        chineuses: [], 
        categoriesContient: [], 
        nomContient: [], 
        descriptionContient: [], 
        marques: [],
        logique: 'OU'
      }

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
    // Filtre : doit avoir une image
    const hasImage = (p.imageUrls && p.imageUrls.length > 0) || p.imageUrl
    if (!hasImage) return false

    // Filtre prix min/max (toujours en ET)
    if (config.prixMin && p.prix < config.prixMin) return false
    if (config.prixMax && p.prix > config.prixMax) return false

    // Filtre jours récents (toujours en ET)
    if (config.joursRecents && p.createdAt) {
      const createdDate = p.createdAt instanceof Timestamp 
        ? p.createdAt.toDate() 
        : new Date(p.createdAt)
      const daysAgo = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      if (daysAgo > config.joursRecents) return false
    }

    // Conditions textuelles
    const conditions: boolean[] = []

    // Filtre chineuses
    if (config.chineuses.length > 0) {
      const chineurMatch = config.chineuses.some(ch => 
        (p.chineur || '').toLowerCase().includes(ch.toLowerCase())
      )
      conditions.push(chineurMatch)
    }

    // Filtre catégories (contient)
    if (config.categoriesContient.length > 0) {
      const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
      const catMatch = config.categoriesContient.some(c => 
        (cat || '').toLowerCase().includes(c.toLowerCase())
      )
      conditions.push(catMatch)
    }

    // Filtre nom (contient)
    if (config.nomContient.length > 0) {
      const nomMatch = config.nomContient.some(n => 
        (p.nom || '').toLowerCase().includes(n.toLowerCase())
      )
      conditions.push(nomMatch)
    }

    // Filtre description (contient)
    if (config.descriptionContient.length > 0) {
      const descMatch = config.descriptionContient.some(d => 
        (p.description || '').toLowerCase().includes(d.toLowerCase())
      )
      conditions.push(descMatch)
    }

    // Filtre marques
    if (config.marques.length > 0) {
      const marqueMatch = config.marques.some(m => 
        (p.marque || '').toLowerCase().includes(m.toLowerCase())
      )
      conditions.push(marqueMatch)
    }

    // Si aucune condition textuelle, on garde le produit
    if (conditions.length === 0) return true

    // Appliquer la logique ET ou OU
    if (config.logique === 'ET') {
      return conditions.every(c => c === true)
    } else {
      return conditions.some(c => c === true)
    }
  })

  return produits
}