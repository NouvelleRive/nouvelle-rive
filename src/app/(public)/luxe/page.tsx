'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useFilteredProducts, type Produit } from '@/lib/siteConfig'
import ProductGrid from '@/components/ProductGrid'
import { useLang, t } from '@/lib/i18n'

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
  const lang = useLang()

  const { produits, loading, loadingMore } = useFilteredProducts(pageId)
  const produitsMixes = useMemo(() => interleaveByCategory(produits), [produits])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">{t('Chargement...', 'Loading...', lang)}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="px-6 py-20">
        <h1
          style={{
            fontSize: 'clamp(40px, 8vw, 120px)',
            fontWeight: '700',
            letterSpacing: '-0.03em',
            lineHeight: '0.9',
            textTransform: 'uppercase'
          }}
        >
          {t('LE LUXE', 'LUXURY', lang)}
        </h1>
      </div>
      <div className="w-full border-t border-black" />
      <ProductGrid produits={produitsMixes} columns={3} />
      {loadingMore && (
        <div className="py-8 text-center">
          <p className="text-gray-500 text-sm">{t('Chargement...', 'Loading...', lang)}</p>
        </div>
      )}
    </div>
  )
}