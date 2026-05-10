import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nos créatrices — chineuses et upcycleuses indépendantes',
  description:
    "Découvrez les créatrices et chineuses indépendantes qui composent NOUVELLE RIVE. Chacune sélectionne ses propres pièces vintage et upcyclées à Paris — ÂGE Paris, BRU, AIM, ANA, COZ, CAM et plus.",
  alternates: { canonical: 'https://www.nouvellerive.eu/nos-creatrices' },
  openGraph: {
    title: 'Nos créatrices — NOUVELLE RIVE',
    description:
      "Les créatrices et chineuses indépendantes de NOUVELLE RIVE — vintage et upcycling à Paris.",
    url: 'https://www.nouvellerive.eu/nos-creatrices',
    type: 'website',
    siteName: 'NOUVELLE RIVE',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Nos créatrices — NOUVELLE RIVE' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nos créatrices — NOUVELLE RIVE',
    description: 'Les créatrices et chineuses indépendantes de NOUVELLE RIVE.',
    images: ['/facade%20paysage.jpg'],
  },
}

export default function NosCreatricesLayout({ children }: { children: React.ReactNode }) {
  return children
}
