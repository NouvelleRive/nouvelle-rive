import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nos pièces upcyclées favorites',
  description:
    "Les plus belles pièces upcyclées sélectionnées par NOUVELLE RIVE : tailleurs ÂGE Paris, créations en deadstock de luxe, pièces uniques upcyclées à Paris. L'upcycling devient haute couture chez nos créatrices.",
  alternates: { canonical: 'https://www.nouvellerive.eu/iconiques-upcy' },
  openGraph: {
    title: 'Nos pièces upcyclées favorites — NOUVELLE RIVE',
    description:
      "Les plus belles pièces upcyclées chez NOUVELLE RIVE — créations uniques de nos créatrices à Paris.",
    url: 'https://www.nouvellerive.eu/iconiques-upcy',
    type: 'website',
    siteName: 'NOUVELLE RIVE',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Pièces upcyclées NOUVELLE RIVE' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nos pièces upcyclées favorites — NOUVELLE RIVE',
    description: 'Les plus belles pièces upcyclées chez NOUVELLE RIVE.',
    images: ['/facade%20paysage.jpg'],
  },
}

export default function IconiquesUpcyLayout({ children }: { children: React.ReactNode }) {
  return children
}
