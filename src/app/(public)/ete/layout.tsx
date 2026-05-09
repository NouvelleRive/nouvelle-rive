import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vintage été — robes, tops, lin, coton',
  description:
    "Pièces vintage et upcyclées d'été chez Nouvelle Rive : robes légères, tops, lin, coton, paillettes pour la plage. Sélection chinée à Paris.",
  alternates: { canonical: 'https://www.nouvellerive.eu/ete' },
  openGraph: {
    title: 'Vintage été — Nouvelle Rive',
    description: "Pièces vintage et upcyclées pour l'été chinées à Paris.",
    url: 'https://www.nouvellerive.eu/ete',
    type: 'website',
    siteName: 'Nouvelle Rive',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Vintage été Nouvelle Rive' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vintage été — Nouvelle Rive',
    description: "Pièces vintage et upcyclées pour l'été.",
    images: ['/facade%20paysage.jpg'],
  },
}

export default function EteLayout({ children }: { children: React.ReactNode }) {
  return children
}
