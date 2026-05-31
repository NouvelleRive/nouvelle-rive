'use client'

import { useMemo } from 'react'
import { useFilteredProducts, type Produit } from '@/lib/siteConfig'
import ProductGrid from '@/components/ProductGrid'
import { useLang, t } from '@/lib/i18n'
import type { ProduitInitial } from '@/lib/produitsServer'

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

export default function LuxeClient({ initialProduits = [] }: { initialProduits?: ProduitInitial[] }) {
  const lang = useLang()
  const { produits, loadingMore } = useFilteredProducts('luxe')
  const produitsMixes = useMemo(() => interleaveByCategory(produits as any), [produits])
  const display = (produitsMixes.length > 0 ? produitsMixes : initialProduits) as any

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="px-6 py-20">
        <h1
          id="titre"
          style={{
            fontSize: 'clamp(40px, 8vw, 120px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 0.9,
            textTransform: 'uppercase',
          }}
        >
          {t('LE LUXE', 'LUXURY', lang)}
        </h1>
      </div>
      <div className="w-full border-t border-black" />
      <ProductGrid produits={display} columns={3} emphasizeBrand videoTrigrammeWhitelist={['PS', 'SOI', 'PRI']} />
      {loadingMore && (
        <div className="py-8 text-center">
          <p className="text-gray-500 text-sm">{t('Chargement...', 'Loading...', lang)}</p>
        </div>
      )}
    </div>
  )
}
