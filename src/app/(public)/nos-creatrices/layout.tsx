import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nos créatrices — chineuses et upcycleuses indépendantes',
  description:
    "Découvrez les créatrices et chineuses indépendantes qui composent Nouvelle Rive. Chacune sélectionne ses propres pièces vintage et upcyclées à Paris — ÂGE Paris, BRU, AIM, ANA, COZ, CAM et plus.",
  alternates: { canonical: 'https://www.nouvellerive.eu/nos-creatrices' },
  openGraph: {
    title: 'Nos créatrices — Nouvelle Rive',
    description:
      "Les créatrices et chineuses indépendantes de Nouvelle Rive — vintage et upcycling à Paris.",
    url: 'https://www.nouvellerive.eu/nos-creatrices',
    type: 'website',
    siteName: 'Nouvelle Rive',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Nos créatrices — Nouvelle Rive' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nos créatrices — Nouvelle Rive',
    description: 'Les créatrices et chineuses indépendantes de Nouvelle Rive.',
    images: ['/facade%20paysage.jpg'],
  },
}

export default function NosCreatricesLayout({ children }: { children: React.ReactNode }) {
  return children
}
