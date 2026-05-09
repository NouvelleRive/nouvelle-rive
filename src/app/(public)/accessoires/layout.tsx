import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Accessoires vintage — sacs, bijoux, lunettes, foulards',
  description:
    "Accessoires vintage et upcyclés chez Nouvelle Rive : sacs Hermès, bijoux upcyclés, lunettes, foulards, ceintures. Sélection chinée à Paris.",
  alternates: { canonical: 'https://www.nouvellerive.eu/accessoires' },
  openGraph: {
    title: 'Accessoires vintage — Nouvelle Rive',
    description: 'Sacs, bijoux, lunettes vintage et upcyclés chinés à Paris.',
    url: 'https://www.nouvellerive.eu/accessoires',
    type: 'website',
    siteName: 'Nouvelle Rive',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Accessoires vintage — Nouvelle Rive' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Accessoires vintage — Nouvelle Rive',
    description: 'Sacs, bijoux, lunettes vintage et upcyclés chinés à Paris.',
    images: ['/facade%20paysage.jpg'],
  },
}

export default function AccessoiresLayout({ children }: { children: React.ReactNode }) {
  return children
}
