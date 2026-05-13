// lib/siteConfig.ts
import { doc, getDoc, collection, query, where, getDocs, Timestamp, orderBy, limit, startAfter, DocumentSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { useState, useEffect } from 'react'

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
  /** IDs de produits explicitement exclus de cette page (ne sont pas supprimés) */
  produitsManquels?: string[]
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
      // Chercher par uid (comme l'admin)
      const chineuse = chineuses.find(c => c.uid === critere.valeur)
      if (chineuse) {
        const match1 = produit.chineur === chineuse.email
        const match2 = produit.chineurUid === chineuse.uid
        const trigramme = chineuse.trigramme?.toUpperCase() || '???'
        const skuUpper = produit.sku?.toUpperCase() || ''
        const match3 = skuUpper.startsWith(trigramme) && (skuUpper.length === trigramme.length || /\d/.test(skuUpper[trigramme.length]))
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

export async function getFilteredProducts(pageId: string): Promise<Produit[]>
export async function getFilteredProducts(
  pageId: string,
  options: {
    limitCount?: number
    lastDoc?: DocumentSnapshot | null
  }
): Promise<{ produits: Produit[], lastDoc: DocumentSnapshot | null, hasMore: boolean }>
export async function getFilteredProducts(
  pageId: string,
  options?: {
    limitCount?: number
    lastDoc?: DocumentSnapshot | null
  }
): Promise<Produit[] | { produits: Produit[], lastDoc: DocumentSnapshot | null, hasMore: boolean }> {
  const configRef = doc(db, 'siteConfig', pageId)
  const configSnap = await getDoc(configRef)
  const config: PageConfig = configSnap.exists() 
    ? { regles: [], ...configSnap.data() }
    : { regles: [] }

  const limitCount = options?.limitCount || 100
let q = options?.lastDoc
  ? query(
      collection(db, 'produits'),
      where('vendu', '==', false),
      orderBy('createdAt', 'desc'),
      startAfter(options.lastDoc),
      limit(limitCount)
    )
  : query(
      collection(db, 'produits'),
      where('vendu', '==', false),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
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

  const exclus = new Set(config.produitsManquels || [])

  produits = produits.filter(p => {
    // Exclus manuellement depuis l'admin pour cette page (sans suppression Firestore)
    if (exclus.has(p.id)) return false

    // Exclure produits vendus (quantité 0) ou retournés/supprimés
    const quantite = (p as any).quantite ?? 1
    if (quantite <= 0) return false
    if ((p as any).statut === 'retour' || (p as any).statut === 'supprime') return false
    if ((p as any).recu === false) return false
    if ((p as any).hidden === true) return false
    if ((p as any).forceDisplay === false) return false

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

  // Tri produits : 1) plus de likes en premier, 2) avec photo portée (faceOnModel/dosOnModel),
  // 3) plus récents en dernier critère.
  produits.sort((a, b) => {
    const likesA = (a as any).likesCount || 0
    const likesB = (b as any).likesCount || 0
    if (likesB !== likesA) return likesB - likesA

    const photosA = (a as any).photos
    const photosB = (b as any).photos
    const wornA = !!(photosA?.faceOnModel || photosA?.dosOnModel)
    const wornB = !!(photosB?.faceOnModel || photosB?.dosOnModel)
    if (wornA !== wornB) return wornB ? 1 : -1

    const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0
    const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0
    return dateB - dateA
  })

  if (options) {
    const lastDocResult = snapshot.docs[snapshot.docs.length - 1] || null
    return { 
      produits, 
      lastDoc: lastDocResult, 
      hasMore: snapshot.docs.length === limitCount 
    }
  }
  return produits
}
export function useFilteredProducts(pageId: string) {
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    // Stratégie : premier batch rapide (150 docs) pour afficher la page tout de suite,
    // puis on continue à charger le reste du catalogue en background par batches de 300.
    // Pendant le background, loadingMore=true → le "Chargement…" reste visible en bas
    // et la recherche/filtres voient les nouveaux produits apparaître dynamiquement.
    let cancelled = false
    setProduits([])
    setLoading(true)
    setLoadingMore(false)

    const loadAll = async () => {
      const first = await getFilteredProducts(pageId, { limitCount: 150 })
      if (cancelled) return
      setProduits(first.produits)
      setLoading(false)

      if (!first.hasMore) return

      setLoadingMore(true)
      let lastDoc = first.lastDoc
      let hasMore = first.hasMore
      while (hasMore && !cancelled) {
        const next = await getFilteredProducts(pageId, { lastDoc, limitCount: 300 })
        if (cancelled) return
        setProduits(prev => [...prev, ...next.produits])
        lastDoc = next.lastDoc
        hasMore = next.hasMore
      }
      if (!cancelled) setLoadingMore(false)
    }

    loadAll().catch(console.error)

    return () => { cancelled = true }
  }, [pageId])

  return { produits, loading, loadingMore }
}