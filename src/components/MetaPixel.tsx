'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { marketingAllowed } from '@/lib/consent'
import { pixelPageView } from '@/lib/metaPixel'
import { captureAttribution } from '@/lib/attribution'

// Monté dans le layout public. À chaque navigation :
//   - capture l'attribution UTM/fbclid (first-party, sans consentement),
//   - envoie un PageView au Pixel UNIQUEMENT si le consentement est accordé.
// L'init du Pixel et le tout premier PageView sont gérés par ConsentBanner.
export default function MetaPixel() {
  const pathname = usePathname()

  useEffect(() => {
    captureAttribution()
    if (marketingAllowed()) pixelPageView()
  }, [pathname])

  return null
}
