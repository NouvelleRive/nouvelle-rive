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
  chineurUid?: string
  sku?: string
  trigramme?: string
  createdAt?: any
  description?: string
}

type Chineuse = {
  uid: string
  nom?: string
  trigramme?: string
  email?: string
}

// Normaliser pour ignorer les accents
const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function matchCritere(produit: Produit, critere: Critere, chineuses: Chineuse[]): boolean {
  if (!critere.valeur) return true
  
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
      const valeurNorm = normalize(critere.valeur)
      const chineuse = chineuses.find(c => 
        normalize(c.nom || '') === valeurNorm ||
        normalize(c.trigramme || '') === valeurNorm
      )
      if (chineuse) {
        const match1 = produit.chineur === chineuse.email
        const match2 = produit.chineurUid === chineuse.uid
        const match3 = Boolean(produit.sku?.toUpperCase().startsWith(chineuse.trigramme?.toUpperCase() || '???'))
        return match1 || match2 || match3
      }
      return false
    
    default:
      return false
  }
}

function matchRegle(produit: Produit, regle: Regle, chineuses: Chineuse[]): boolean {
  if (regle.criteres.length === 0) return false
  return regle.criteres.every(critere => matchCritere(produit, critere, chineuses))
}

export async function getFilteredProducts(pageId: string): Promise<Produit[]> {
  const configRef = doc(db, 'siteConfig', pageId)
  const configSnap = await getDoc(configRef)
  const config: PageConfig = configSnap.exists() 
    ? { regles: [], ...configSnap.data() }
    : { regles: [] }

  const q = query(
    collection(db, 'produits'),
    where('vendu', '==', false)
  )
  const snapshot = await getDocs(q)
  let produits = snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  })) as Produit[]

  const chineusesSnap = await getDocs(collection(db, 'chineuse'))
  const chineuses: Chineuse[] = chineusesSnap.docs.map(d => ({
    uid: d.id,
    nom: d.data().nom,
    trigramme: d.data().trigramme,
    email: d.data().email,
  }))

  produits = produits.filter(p => {
    const hasImage = (p.imageUrls && p.imageUrls.length > 0) || p.imageUrl
    if (!hasImage) return false

    if (config.prixMin && p.prix < config.prixMin) return false
    if (config.prixMax && p.prix > config.prixMax) return false

    if (config.joursRecents && p.createdAt) {
      const createdDate = p.createdAt instanceof Timestamp 
        ? p.createdAt.toDate() 
        : new Date(p.createdAt)
      const daysAgo = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      if (daysAgo > config.joursRecents) return false
    }

    if (config.regles.length === 0) return true

    return config.regles.some(regle => matchRegle(p, regle, chineuses))
  })

  return produits
}