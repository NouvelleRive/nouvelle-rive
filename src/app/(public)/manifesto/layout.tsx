import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Manifesto — pourquoi Nouvelle Rive',
  description:
    "Le manifesto de Nouvelle Rive : repenser la mode par le vintage et l'upcycling, soutenir les créatrices indépendantes, et faire vivre la mode circulaire au Marais à Paris.",
  alternates: { canonical: 'https://www.nouvellerive.eu/manifesto' },
  openGraph: {
    title: 'Manifesto — Nouvelle Rive',
    description: "Repenser la mode par le vintage et l'upcycling, à Paris.",
    url: 'https://www.nouvellerive.eu/manifesto',
    type: 'article',
    siteName: 'Nouvelle Rive',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Manifesto Nouvelle Rive' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Manifesto — Nouvelle Rive',
    description: "Repenser la mode par le vintage et l'upcycling, à Paris.",
    images: ['/facade%20paysage.jpg'],
  },
}

export default function ManifestoLayout({ children }: { children: React.ReactNode }) {
  return children
}
