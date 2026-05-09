import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vintage soirée — robes de cocktail, tenues de fête',
  description:
    "Robes vintage et tenues de soirée chinées par Nouvelle Rive : robes de cocktail, robes longues, tenues paillettes, satin. Pour briller, en seconde main.",
  alternates: { canonical: 'https://www.nouvellerive.eu/soiree' },
  openGraph: {
    title: 'Vintage soirée — Nouvelle Rive',
    description: 'Robes vintage et tenues de fête chinées à Paris.',
    url: 'https://www.nouvellerive.eu/soiree',
    type: 'website',
    siteName: 'Nouvelle Rive',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Vintage soirée — Nouvelle Rive' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vintage soirée — Nouvelle Rive',
    description: 'Robes vintage et tenues de fête chinées à Paris.',
    images: ['/facade%20paysage.jpg'],
  },
}

export default function SoireeLayout({ children }: { children: React.ReactNode }) {
  return children
}
