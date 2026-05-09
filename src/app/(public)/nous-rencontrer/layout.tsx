import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nous rencontrer — boutique vintage Le Marais Paris',
  description:
    "Rencontrez Nouvelle Rive en vrai : boutique vintage et upcyclée au 8 rue des Ecouffes, 75004 Paris, dans le Marais. Toutes les pièces sont aussi disponibles en boutique.",
  alternates: { canonical: 'https://www.nouvellerive.eu/nous-rencontrer' },
  openGraph: {
    title: 'Notre boutique vintage Le Marais — Nouvelle Rive',
    description: 'Boutique vintage et upcyclée 8 rue des Ecouffes, 75004 Paris.',
    url: 'https://www.nouvellerive.eu/nous-rencontrer',
    type: 'website',
    siteName: 'Nouvelle Rive',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Boutique Nouvelle Rive — 8 rue des Ecouffes, Le Marais' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Notre boutique vintage Le Marais — Nouvelle Rive',
    description: '8 rue des Ecouffes, 75004 Paris.',
    images: ['/facade%20paysage.jpg'],
  },
}

export default function NousRencontrerLayout({ children }: { children: React.ReactNode }) {
  return children
}
