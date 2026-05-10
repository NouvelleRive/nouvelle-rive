import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nouveautés — les dernières pièces vintage et upcyclées',
  description:
    "Les dernières pièces vintage et upcyclées arrivées chez NOUVELLE RIVE. Mises à jour quotidiennes — ce qui vient d'entrer en boutique au Marais à Paris.",
  alternates: { canonical: 'https://www.nouvellerive.eu/new-in' },
  openGraph: {
    title: 'Nouveautés — NOUVELLE RIVE',
    description: "Les dernières pièces vintage et upcyclées entrées en boutique.",
    url: 'https://www.nouvellerive.eu/new-in',
    type: 'website',
    siteName: 'NOUVELLE RIVE',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Nouveautés NOUVELLE RIVE' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nouveautés — NOUVELLE RIVE',
    description: "Les dernières pièces vintage et upcyclées entrées en boutique.",
    images: ['/facade%20paysage.jpg'],
  },
}

export default function NewInLayout({ children }: { children: React.ReactNode }) {
  return children
}
