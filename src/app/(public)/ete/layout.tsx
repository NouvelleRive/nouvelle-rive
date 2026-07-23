import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ÉTÉ — Pièces légères, estivales, colorées',
  description:
    "Robe florale, jupes Y2K, top tank, camo top, floral skirt — pièces vintage et upcyclées d'été chinées à Paris.",
  alternates: { canonical: 'https://www.nouvellerive.eu/ete' },
  openGraph: {
    title: 'ÉTÉ — Pièces légères, estivales, colorées | NOUVELLE RIVE',
    description: "Robe florale, jupes Y2K, top tank, camo top, floral skirt — pièces vintage et upcyclées d'été chinées à Paris.",
    url: 'https://www.nouvellerive.eu/ete',
    type: 'website',
    siteName: 'NOUVELLE RIVE',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Vintage été NOUVELLE RIVE' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ÉTÉ — Pièces légères, estivales, colorées | NOUVELLE RIVE',
    description: "Robe florale, jupes Y2K, top tank, camo top, floral skirt — pièces vintage et upcyclées d'été.",
    images: ['/facade%20paysage.jpg'],
  },
}

export default function EteLayout({ children }: { children: React.ReactNode }) {
  return children
}
