import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'HIVER — Manteaux, pulls, laine et fourrure vintage',
  description:
    "Manteaux, vestes en cuir, pulls en laine, cols roulés, fourrure — pièces vintage et upcyclées d'hiver chinées à Paris.",
  alternates: { canonical: 'https://www.nouvellerive.eu/hiver' },
  openGraph: {
    title: 'HIVER — Manteaux, pulls, laine et fourrure vintage | NOUVELLE RIVE',
    description: "Manteaux, vestes en cuir, pulls en laine, cols roulés, fourrure — pièces vintage et upcyclées d'hiver chinées à Paris.",
    url: 'https://www.nouvellerive.eu/hiver',
    type: 'website',
    siteName: 'NOUVELLE RIVE',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Vintage hiver NOUVELLE RIVE' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HIVER — Manteaux, pulls, laine et fourrure vintage | NOUVELLE RIVE',
    description: "Manteaux, vestes en cuir, pulls en laine, cols roulés, fourrure — pièces vintage et upcyclées d'hiver.",
    images: ['/facade%20paysage.jpg'],
  },
}

export default function HiverLayout({ children }: { children: React.ReactNode }) {
  return children
}
