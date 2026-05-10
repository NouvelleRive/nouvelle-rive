'use client'

import { usePathname } from 'next/navigation'
import { useFilteredProducts } from '@/lib/siteConfig'
import ProductGrid from '@/components/ProductGrid'
import { useLang, t } from '@/lib/i18n'

export default function Page() {
  const pathname = usePathname()
  const pageId = pathname.split('/').pop() || ''
  const lang = useLang()

  const { produits, loading, loadingMore } = useFilteredProducts(pageId)

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
          id="titre"
          style={{
            fontSize: 'clamp(40px, 8vw, 120px)',
            fontWeight: '700',
            letterSpacing: '-0.03em',
            lineHeight: '0.9',
            textTransform: 'uppercase'
          }}
        >
          {t('(PLUTÔT) FEMME', '(SO-CALLED) WOMEN', lang)}
        </h1>
      </div>
      <div className="w-full border-t border-black" />
      <ProductGrid produits={produits} columns={3} />
      {loadingMore && (
        <div className="py-8 text-center">
          <p className="text-gray-500 text-sm">{t('Chargement...', 'Loading...', lang)}</p>
        </div>
      )}
    </div>
  )
}
