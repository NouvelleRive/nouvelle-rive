import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vintage hiver — manteaux, fourrure, laine',
  description:
    "Pièces vintage et upcyclées d'hiver chez Nouvelle Rive : manteaux, fourrures, vestes en laine, doudounes, pulls maille. Sélection chinée à Paris.",
  alternates: { canonical: 'https://www.nouvellerive.eu/hiver' },
  openGraph: {
    title: 'Vintage hiver — Nouvelle Rive',
    description: "Manteaux, fourrures, vestes laine vintage chinés à Paris.",
    url: 'https://www.nouvellerive.eu/hiver',
    type: 'website',
    siteName: 'Nouvelle Rive',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Vintage hiver Nouvelle Rive' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vintage hiver — Nouvelle Rive',
    description: 'Manteaux, fourrures, laine vintage chinés à Paris.',
    images: ['/facade%20paysage.jpg'],
  },
}

export default function HiverLayout({ children }: { children: React.ReactNode }) {
  return children
}
