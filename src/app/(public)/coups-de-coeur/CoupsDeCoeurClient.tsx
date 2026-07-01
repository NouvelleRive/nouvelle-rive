'use client'

import ProductGrid from '@/components/ProductGrid'
import { useLang, t } from '@/lib/i18n'
import type { ProduitInitial } from '@/lib/produitsServer'

export default function CoupsDeCoeurClient({ initialProduits = [] }: { initialProduits?: ProduitInitial[] }) {
  const lang = useLang()
  const display = initialProduits as any

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
          {t('Nos pièces préférées', 'Our favourites', lang)}
        </h1>
      </div>
      <div className="w-full border-t border-black" />

      {display.length === 0 ? (
        <div className="py-20 text-center">
          <p
            className="uppercase tracking-widest text-gray-400"
            style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '11px' }}
          >
            {t('Aucune pièce pour le moment', 'No pieces yet', lang)}
          </p>
        </div>
      ) : (
        <ProductGrid produits={display} columns={3} />
      )}
    </div>
  )
}
