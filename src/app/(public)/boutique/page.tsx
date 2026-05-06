// app/boutique/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useFilteredProducts } from '@/lib/siteConfig'
import ProductGrid from '@/components/ProductGrid'
import CountdownPromo from '@/components/CountdownPromo'
import { useLang, t } from '@/lib/i18n'

export default function BoutiquePage() {
  const { produits, loading, loadingMore } = useFilteredProducts('new-in')
  const [nombreAchats, setNombreAchats] = useState(0)
  const lang = useLang()

  useEffect(() => {
    const achats = localStorage.getItem('nouvelle-rive-achats')
    setNombreAchats(achats ? parseInt(achats) : 0)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">{t('Chargement...', 'Loading...', lang)}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <ProductGrid produits={produits} columns={3} />

      {loadingMore && (
        <div className="py-8 text-center">
          <p className="text-gray-500 text-sm">{t('Chargement...', 'Loading...', lang)}</p>
        </div>
      )}

      <CountdownPromo nombreAchats={nombreAchats} />

      <footer className="border-t py-8 mt-12">
        <div className="text-center text-gray-600 text-sm space-y-2">
          <p>© 2026 Nouvelle Rive • 8 rue des Écouffes, Paris</p>
          <div className="flex justify-center gap-4 text-xs text-gray-400">
            <a href="/legal/mentions-cgv" className="hover:text-black transition-colors">
              {t('Mentions légales & CGV', 'Legal notice & Terms', lang)}
            </a>
            <a href="/legal/retours" className="hover:text-black transition-colors">
              {t('Retours', 'Returns', lang)}
            </a>
            <a href="/legal/confidentialite" className="hover:text-black transition-colors">
              {t('Confidentialité', 'Privacy', lang)}
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
