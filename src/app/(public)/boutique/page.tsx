  // app/boutique/page.tsx
  'use client'

  import { useEffect, useState, useCallback, useMemo } from 'react'
  import { collection, query, where, getDocs, orderBy, limit, startAfter, DocumentSnapshot } from 'firebase/firestore'
  import { db } from '@/lib/firebaseConfig'
  import ProductGrid from '@/components/ProductGrid'
  import CountdownPromo from '@/components/CountdownPromo'

  type Produit = {
    id: string
    nom: string
    prix: number
    imageUrls: string[]
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

  function matchesSearch(produit: Produit, searchTerms: string[]): boolean {
  if (searchTerms.length === 0) return true
  const searchableText = [
    produit.nom,
    produit.marque,
    produit.categorie,
    produit.description,
    produit.couleur,
    produit.taille
  ].filter(Boolean).join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return searchTerms.every(term => searchableText.includes(term))
}

  export default function BoutiquePage() {
    const [produits, setProduits] = useState<Produit[]>([])
    const [loading, setLoading] = useState(true)
    const [nombreAchats, setNombreAchats] = useState(0)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const PRODUCTS_PER_PAGE = 24

    const searchTerms = useMemo(() => {
      return searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(term => term.length > 0)
    }, [searchQuery])

    const produitsFiltres = useMemo(() => {
      if (searchTerms.length === 0) return produits
      return produits.filter(p => matchesSearch(p, searchTerms))
    }, [produits, searchTerms])

    useEffect(() => {
      // Récupérer le nombre d'achats du jour
      const achats = localStorage.getItem('nouvelle-rive-achats')
      setNombreAchats(achats ? parseInt(achats) : 0)

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
              // Exclure produits vendus (quantité 0) ou retournés/supprimés
              if ((d.quantite ?? 1) <= 0) return false
              if (d.statut === 'retour' || d.statut === 'supprime') return false
              if (d.recu === false) return false
              return true
            })
            .map(doc => {
              const d = doc.data()
              const imageUrls = d.photos?.face 
                ? [d.photos.face, ...(d.imageUrls || [])]
                : d.imageUrls || []
              return {
                id: doc.id,
                ...d,
                imageUrls
              }
            }) as Produit[]

          // Filtrer : seulement les produits avec photo détourée OU tryon OU forcé
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
          
        } catch (error) {
          console.error('Erreur:', error)
        } finally {
          setLoading(false)
        }
      }

      fetchProduits()
    }, [])

    // Load more function
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDoc) return
    
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
          if (d.enBoutique !== true) return false
          return true
        })
        .map(doc => {
          const d = doc.data()
          const imageUrls = d.photos?.face 
            ? [d.photos.face, ...(d.imageUrls || [])]
            : d.imageUrls || []
          return { id: doc.id, ...d, imageUrls }
        }) as Produit[]

      const produitsVisibles = data.filter(p => {
        if (p.forceDisplay === true) return true
        if (p.photos?.face) return true
        if (p.photos?.faceOnModel) return true
        return false
      })

      setProduits(prev => [...prev, ...produitsVisibles])
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null)
      setHasMore(snapshot.docs.length === 100)
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, lastDoc])

  // Infinite scroll detection
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
        loadMore()
      }
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [loadMore])

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Chargement...</p>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-white">
        {/* Barre de recherche */}
        <div className="sticky top-0 z-40 bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher... (ex: sac chanel noir)"
                className="w-full px-4 py-2.5 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black focus:bg-white transition-colors"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-xs text-gray-500 mt-2">{produitsFiltres.length} résultat{produitsFiltres.length > 1 ? 's' : ''}</p>
            )}
          </div>
        </div>

        {/* Grille produits */}
        <ProductGrid produits={produitsFiltres} columns={3} />

        {loadingMore && (
          <div className="py-8 text-center">
            <p className="text-gray-500 text-sm">Chargement...</p>
          </div>
        )}

        {/* Countdown promo (flottant en bas) */}
        <CountdownPromo nombreAchats={nombreAchats} />

        {/* Footer */}
        <footer className="border-t py-8 mt-12">
          <div className="text-center text-gray-600 text-sm">
            <p>© 2025 Nouvelle Rive • 8 rue des Ecouffes, Paris</p>
          </div>
        </footer>
      </div>
    )
  }