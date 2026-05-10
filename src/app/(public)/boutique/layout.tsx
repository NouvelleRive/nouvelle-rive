import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Boutique — vintage et upcyclé chinés à Paris',
  description:
    "Toutes les pièces vintage et upcyclées de NOUVELLE RIVE : sacs, robes, vestes, blazers, chemises, accessoires. Sélection chinée et certifiée à Paris, dans notre boutique du Marais.",
  alternates: { canonical: 'https://www.nouvellerive.eu/' },
  openGraph: {
    title: 'Boutique vintage et upcyclée — NOUVELLE RIVE',
    description: 'Toutes les pièces vintage et upcyclées chinées par NOUVELLE RIVE à Paris.',
    url: 'https://www.nouvellerive.eu/boutique',
    type: 'website',
    siteName: 'NOUVELLE RIVE',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Boutique NOUVELLE RIVE' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Boutique vintage et upcyclée — NOUVELLE RIVE',
    description: 'Toutes les pièces vintage et upcyclées chinées à Paris.',
    images: ['/facade%20paysage.jpg'],
  },
}

export default function BoutiqueLayout({ children }: { children: React.ReactNode }) {
  return children
}
