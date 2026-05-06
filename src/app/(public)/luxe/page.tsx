'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useFilteredProducts, type Produit } from '@/lib/siteConfig'
import ProductGrid from '@/components/ProductGrid'

function interleaveByCategory(produits: Produit[]): Produit[] {
  const groups = new Map<string, Produit[]>()
  for (const p of produits) {
    const cat = (typeof p.categorie === 'object' ? p.categorie?.label : p.categorie) || 'autre'
    const key = String(cat).toLowerCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }
  const queues = Array.from(groups.values())
  const result: Produit[] = []
  while (queues.some(q => q.length > 0)) {
    for (const q of queues) {
      const item = q.shift()
      if (item) result.push(item)
    }
  }
  return result
}

export default function Page() {
  const pathname = usePathname()
  const pageId = pathname.split('/').pop() || ''

  const { produits, loading, loadingMore } = useFilteredProducts(pageId)
  const produitsMixes = useMemo(() => interleaveByCategory(produits), [produits])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <ProductGrid produits={produitsMixes} columns={3} />
      {loadingMore && (
        <div className="py-8 text-center">
          <p className="text-gray-500 text-sm">Chargement...</p>
        </div>
      )}
    </div>
  )
}