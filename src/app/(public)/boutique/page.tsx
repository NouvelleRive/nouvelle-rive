  // app/boutique/page.tsx
  'use client'

  import { useEffect, useState, useMemo } from 'react'
  import { useProduitsDisponibles, Produit } from '@/lib/hooks/useProduitsDisponibles'
  import ProductGrid from '@/components/ProductGrid'
  import CountdownPromo from '@/components/CountdownPromo'


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
   const { produits, loading, loadingMore } = useProduitsDisponibles()
   const [nombreAchats, setNombreAchats] = useState(0)
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
      }, [])

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
                placeholder="Rechercher"
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