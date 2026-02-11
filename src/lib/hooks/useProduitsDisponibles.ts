import { useState, useEffect, useCallback, useRef } from 'react'
import { collection, query, where, getDocs, orderBy, limit, startAfter, DocumentSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'

export type Produit = {
  id: string
  nom: string
  prix: number
  imageUrls: string[]
  imageUrl?: string
  categorie: string
  marque?: string
  vendu: boolean
  promotion?: boolean
  createdAt?: any
  photos?: {
    face?: string
    faceOnModel?: string
    dos?: string
    details?: string[]
  }
  forceDisplay?: boolean
  description?: string
  couleur?: string
  taille?: string
}

export function useProduitsDisponibles() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)
  const loadingRef = useRef(false)

  useEffect(() => {
    async function fetchProduits() {
      try {
        const q = query(
          collection(db, 'produits'),
          where('vendu', '==', false),
          orderBy('createdAt', 'desc'),
          limit(100)
        )
        
        const snapshot = await getDocs(q)
        const data = snapshot.docs
          .filter(doc => {
            const d = doc.data()
            if ((d.quantite ?? 1) <= 0) return false
            if (d.statut === 'retour' || d.statut === 'supprime') return false
            if (d.recu === false) return false
            if (d.hidden === true) return false
            return true
          })
          .map(doc => {
            const d = doc.data()
            const imageUrls = d.imageUrls?.length > 0 ? d.imageUrls : d.photos?.face ? [d.photos.face] : []
            return { id: doc.id, ...d, imageUrls }
          }) as Produit[]

        const produitsVisibles = data.filter(p => {
          if (p.forceDisplay === true) return true
          if (p.imageUrls && p.imageUrls.length > 0) return true
          if (p.imageUrl) return true
          if (p.photos?.face) return true
          if (p.photos?.faceOnModel) return true
          return false
        })

        setProduits(produitsVisibles)
        setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null)
        setHasMore(snapshot.docs.length === 100)
      } catch (err: any) {
        console.error('Erreur:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchProduits()
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || !lastDoc) return
    loadingRef.current = true
    setLoadingMore(true)
    try {
      const q = query(
        collection(db, 'produits'),
        where('vendu', '==', false),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(100)
      )
      
      const snapshot = await getDocs(q)
      const data = snapshot.docs
        .filter(doc => {
          const d = doc.data()
          if ((d.quantite ?? 1) <= 0) return false
          if (d.statut === 'retour' || d.statut === 'supprime') return false
          if (d.recu === false) return false
          if (d.hidden === true) return false
          return true
        })
        .map(doc => {
          const d = doc.data()
          const imageUrls = d.imageUrls?.length > 0 ? d.imageUrls : d.photos?.face ? [d.photos.face] : []
          return { id: doc.id, ...d, imageUrls }
        }) as Produit[]

      const produitsVisibles = data.filter(p => {
        if (p.forceDisplay === true) return true
        if (p.imageUrls && p.imageUrls.length > 0) return true
        if (p.imageUrl) return true
        if (p.photos?.face) return true
        if (p.photos?.faceOnModel) return true
        return false
      })

      setProduits(prev => {
        const existingIds = new Set(prev.map(p => p.id))
        const newOnly = produitsVisibles.filter(p => !existingIds.has(p.id))
        return [...prev, ...newOnly]
      })
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null)
      setHasMore(snapshot.docs.length === 100)
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      loadingRef.current = false
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, lastDoc])

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
        loadMore()
      }
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [loadMore])

  return { produits, loading, error, loadingMore }
}