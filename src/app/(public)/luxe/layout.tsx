import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vintage de luxe — Hermès, Chanel, Dior, Louis Vuitton',
  description:
    "Pièces de luxe vintage et seconde main chez NOUVELLE RIVE : Hermès, Chanel, Dior, Louis Vuitton, Saint Laurent. Authentifiées et chinées à Paris dans le Marais.",
  alternates: { canonical: 'https://www.nouvellerive.eu/luxe' },
  openGraph: {
    title: 'Vintage de luxe — NOUVELLE RIVE',
    description: 'Hermès, Chanel, Dior, LV vintage authentifiés et chinés à Paris.',
    url: 'https://www.nouvellerive.eu/luxe',
    type: 'website',
    siteName: 'NOUVELLE RIVE',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Vintage de luxe — NOUVELLE RIVE' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vintage de luxe — NOUVELLE RIVE',
    description: 'Hermès, Chanel, Dior, LV vintage authentifiés à Paris.',
    images: ['/facade%20paysage.jpg'],
  },
}

export default function LuxeLayout({ children }: { children: React.ReactNode }) {
  return children
}
