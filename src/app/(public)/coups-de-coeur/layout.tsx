import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nos coups de cœur — pièces préférées',
  description:
    "Les coups de cœur des chineuses Nouvelle Rive : nos pièces vintage et upcyclées préférées du moment. Une sélection ultra-pointue chinée à Paris.",
  alternates: { canonical: 'https://www.nouvellerive.eu/coups-de-coeur' },
  openGraph: {
    title: 'Nos coups de cœur — Nouvelle Rive',
    description: 'Les pièces vintage et upcyclées préférées de nos chineuses.',
    url: 'https://www.nouvellerive.eu/coups-de-coeur',
    type: 'website',
    siteName: 'Nouvelle Rive',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Coups de cœur Nouvelle Rive' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nos coups de cœur — Nouvelle Rive',
    description: 'Les pièces vintage et upcyclées préférées de nos chineuses.',
    images: ['/facade%20paysage.jpg'],
  },
}

export default function CoupsDeCoeurLayout({ children }: { children: React.ReactNode }) {
  return children
}
