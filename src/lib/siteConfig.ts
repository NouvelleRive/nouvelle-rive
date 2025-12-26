// lib/siteConfig.ts
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'

type Critere = {
  type: 'categorie' | 'nom' | 'description' | 'marque' | 'chineuse'
  valeur: string
}

type Regle = {
  id: string
  criteres: Critere[]
}

export type PageConfig = {
  regles: Regle[]
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
  description?: string
}

/**
 * Vérifie si un produit correspond à un critère
 */
function matchCritere(produit: Produit, critere: Critere): boolean {
  if (!critere.valeur) return true // Critère vide = toujours vrai
  
  const valeurLower = critere.valeur.toLowerCase()
  
  switch (critere.type) {
    case 'categorie':
      const cat = typeof produit.categorie === 'object' ? produit.categorie?.label : produit.categorie
      return (cat || '').toLowerCase().includes(valeurLower)
    
    case 'nom':
      return (produit.nom || '').toLowerCase().includes(valeurLower)
    
    case 'description':
      return (produit.description || '').toLowerCase().includes(valeurLower)
    
    case 'marque':
      return (produit.marque || '').toLowerCase().includes(valeurLower)
    
    case 'chineuse':
       const chineuse = chineuses.find(c => 
          (c.nom || '').toLowerCase() === valeurLower
        )
        if (chineuse?.trigramme) {
          return (produit.trigramme || '').toLowerCase() === chineuse.trigramme.toLowerCase()
        }
        return false
    
    default:
      return false
  }
}

/**
 * Vérifie si un produit correspond à une règle (tous les critères doivent matcher = ET)
 */
function matchRegle(produit: Produit, regle: Regle): boolean {
  if (regle.criteres.length === 0) return false // Règle vide = ne matche rien
  return regle.criteres.every(critere => matchCritere(produit, critere))
}

/**
 * Charge les produits filtrés selon la config d'une page
 */
export async function getFilteredProducts(pageId: string): Promise<Produit[]> {
  // 1. Charger la config
  const configRef = doc(db, 'siteConfig', pageId)
  const configSnap = await getDoc(configRef)
  const config: PageConfig = configSnap.exists() 
    ? { regles: [], ...configSnap.data() }
    : { regles: [] }

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

    // Filtre prix min/max (toujours appliqué)
    if (config.prixMin && p.prix < config.prixMin) return false
    if (config.prixMax && p.prix > config.prixMax) return false

    // Filtre jours récents (toujours appliqué)
    if (config.joursRecents && p.createdAt) {
      const createdDate = p.createdAt instanceof Timestamp 
        ? p.createdAt.toDate() 
        : new Date(p.createdAt)
      const daysAgo = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      if (daysAgo > config.joursRecents) return false
    }

    // Si aucune règle, on garde tous les produits (qui passent les filtres globaux)
    if (config.regles.length === 0) return true

    // Vérifier si au moins une règle matche (OU)
    return config.regles.some(regle => matchRegle(p, regle))
  })

  return produits
}