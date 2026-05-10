import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vintage femme — robes, vestes, blazers, sacs',
  description:
    "Toutes les pièces vintage et upcyclées femme chez NOUVELLE RIVE : robes, vestes, blazers, sacs, chemises, accessoires. Sélection chinée à Paris dans notre boutique du Marais.",
  alternates: { canonical: 'https://www.nouvellerive.eu/femme' },
  openGraph: {
    title: 'Vintage femme — NOUVELLE RIVE',
    description: 'Pièces vintage et upcyclées femme chinées à Paris.',
    url: 'https://www.nouvellerive.eu/femme',
    type: 'website',
    siteName: 'NOUVELLE RIVE',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Vintage femme — NOUVELLE RIVE' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vintage femme — NOUVELLE RIVE',
    description: 'Pièces vintage et upcyclées femme chinées à Paris.',
    images: ['/facade%20paysage.jpg'],
  },
}

export default function FemmeLayout({ children }: { children: React.ReactNode }) {
  return children
}
