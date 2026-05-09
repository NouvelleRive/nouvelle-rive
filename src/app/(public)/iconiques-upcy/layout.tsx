import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nos pièces upcyclées favorites',
  description:
    "Les plus belles pièces upcyclées sélectionnées par Nouvelle Rive : tailleurs ÂGE Paris, créations en deadstock de luxe, pièces uniques upcyclées à Paris. L'upcycling devient haute couture chez nos créatrices.",
  alternates: { canonical: 'https://www.nouvellerive.eu/iconiques-upcy' },
  openGraph: {
    title: 'Nos pièces upcyclées favorites — Nouvelle Rive',
    description:
      "Les plus belles pièces upcyclées chez Nouvelle Rive — créations uniques de nos créatrices à Paris.",
    url: 'https://www.nouvellerive.eu/iconiques-upcy',
    type: 'website',
    siteName: 'Nouvelle Rive',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Pièces upcyclées Nouvelle Rive' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nos pièces upcyclées favorites — Nouvelle Rive',
    description: 'Les plus belles pièces upcyclées chez Nouvelle Rive.',
    images: ['/facade%20paysage.jpg'],
  },
}

export default function IconiquesUpcyLayout({ children }: { children: React.ReactNode }) {
  return children
}
