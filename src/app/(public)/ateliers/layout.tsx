import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ateliers bijou upcyclé avec une designeuse',
  description:
    "Ateliers de création bijou upcyclé chez Nouvelle Rive, animés par une designeuse, dans notre boutique du Marais. Réservez votre place et créez votre pièce unique à Paris.",
  alternates: { canonical: 'https://www.nouvellerive.eu/ateliers' },
  openGraph: {
    title: 'Ateliers bijou upcyclé — Nouvelle Rive',
    description: 'Atelier upcyclé avec une designeuse, à Paris dans le Marais.',
    url: 'https://www.nouvellerive.eu/ateliers',
    type: 'website',
    siteName: 'Nouvelle Rive',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Ateliers bijou upcyclé Nouvelle Rive' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ateliers bijou upcyclé — Nouvelle Rive',
    description: 'Atelier bijou upcyclé avec une designeuse, à Paris.',
    images: ['/facade%20paysage.jpg'],
  },
}

export default function AteliersLayout({ children }: { children: React.ReactNode }) {
  return children
}
