import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vintage soirée — robes de cocktail, tenues de fête',
  description:
    "Robes vintage et tenues de soirée chinées par NOUVELLE RIVE : robes de cocktail, robes longues, tenues paillettes, satin. Pour briller, en seconde main.",
  alternates: { canonical: 'https://www.nouvellerive.eu/soiree' },
  openGraph: {
    title: 'Vintage soirée — NOUVELLE RIVE',
    description: 'Robes vintage et tenues de fête chinées à Paris.',
    url: 'https://www.nouvellerive.eu/soiree',
    type: 'website',
    siteName: 'NOUVELLE RIVE',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Vintage soirée — NOUVELLE RIVE' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vintage soirée — NOUVELLE RIVE',
    description: 'Robes vintage et tenues de fête chinées à Paris.',
    images: ['/facade%20paysage.jpg'],
  },
}

export default function SoireeLayout({ children }: { children: React.ReactNode }) {
  return children
}
