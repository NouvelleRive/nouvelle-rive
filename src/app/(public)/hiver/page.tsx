// app/(public)/hiver/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { getFilteredProducts, Produit } from '@/lib/siteConfig'
import ProductGrid from '@/components/ProductGrid'

export default function HiverPage() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFilteredProducts('hiver')
      .then(setProduits)
      .catch(console.error)
      .finally(() => setLoading(false))
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
      <ProductGrid produits={produits} columns={3} />
    </div>
  )
}