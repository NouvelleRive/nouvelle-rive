'use client'

import { useFilteredProducts } from '@/lib/siteConfig'
import ProductGrid from '@/components/ProductGrid'
import { useLang, t } from '@/lib/i18n'
import type { ProduitInitial } from '@/lib/produitsServer'

type Props = {
  pageId: string
  h1Fr: string
  h1En: string
  initialProduits?: ProduitInitial[]
}

export default function CategoryListingClient({ pageId, h1Fr, h1En, initialProduits = [] }: Props) {
  const lang = useLang()
  const { produits, loadingMore } = useFilteredProducts(pageId)

  // Tant que le client n'a pas rapatrié sa liste filtrée complète, on affiche le pre-render serveur.
  const display = (produits.length > 0 ? produits : initialProduits) as any

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
          {t(h1Fr, h1En, lang)}
        </h1>
      </div>
      <div className="w-full border-t border-black" />
      <ProductGrid produits={display} columns={3} />
      {loadingMore && (
        <div className="py-8 text-center">
          <p className="text-gray-500 text-sm">{t('Chargement...', 'Loading...', lang)}</p>
        </div>
      )}
    </div>
  )
}
