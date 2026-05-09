import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Les iconiques du vintage',
  description:
    "Les pièces iconiques du vintage, sélectionnées par Nouvelle Rive : Levi's 501, sacs Hermès, perfectos, Burberry, blazers ÂGE Paris… Les essentiels intemporels chinés à Paris, dans notre boutique du Marais.",
  alternates: { canonical: 'https://www.nouvellerive.eu/les-iconiques' },
  openGraph: {
    title: 'Les iconiques du vintage — Nouvelle Rive',
    description:
      "Les pièces iconiques du vintage chez Nouvelle Rive : les essentiels intemporels chinés à Paris.",
    url: 'https://www.nouvellerive.eu/les-iconiques',
    type: 'website',
    siteName: 'Nouvelle Rive',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Les iconiques du vintage — Nouvelle Rive' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Les iconiques du vintage — Nouvelle Rive',
    description: "Les essentiels intemporels du vintage chinés à Paris.",
    images: ['/facade%20paysage.jpg'],
  },
}

export default function LesIconiquesLayout({ children }: { children: React.ReactNode }) {
  return children
}
