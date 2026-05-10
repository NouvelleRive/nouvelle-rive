import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vintage homme — vestes, chemises, costumes',
  description:
    "Pièces vintage et upcyclées homme chez NOUVELLE RIVE : vestes, chemises, costumes, denim, accessoires. Une sélection chinée à Paris, dans notre boutique du Marais.",
  alternates: { canonical: 'https://www.nouvellerive.eu/homme' },
  openGraph: {
    title: 'Vintage homme — NOUVELLE RIVE',
    description: 'Pièces vintage et upcyclées homme chinées à Paris.',
    url: 'https://www.nouvellerive.eu/homme',
    type: 'website',
    siteName: 'NOUVELLE RIVE',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Vintage homme — NOUVELLE RIVE' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vintage homme — NOUVELLE RIVE',
    description: 'Pièces vintage et upcyclées homme chinées à Paris.',
    images: ['/facade%20paysage.jpg'],
  },
}

export default function HommeLayout({ children }: { children: React.ReactNode }) {
  return children
}
