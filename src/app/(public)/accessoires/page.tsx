// app/(public)/accessoires/page.tsx
'use client'

import { useFilteredProducts } from '@/lib/siteConfig'
import ProductGrid from '@/components/ProductGrid'

export default function NewInPage() {
  const { produits, loading, loadingMore } = useFilteredProducts('new-in')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <ProductGrid produits={produits} columns={3} />
      {loadingMore && (
        <div className="py-8 text-center">
          <p className="text-gray-500 text-sm">Chargement...</p>
        </div>
      )}
    </div>
  )
}