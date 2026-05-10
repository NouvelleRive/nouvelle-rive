import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Manifesto — pourquoi NOUVELLE RIVE',
  description:
    "Le manifesto de NOUVELLE RIVE : repenser la mode par le vintage et l'upcycling, soutenir les créatrices indépendantes, et faire vivre la mode circulaire au Marais à Paris.",
  alternates: { canonical: 'https://www.nouvellerive.eu/manifesto' },
  openGraph: {
    title: 'Manifesto — NOUVELLE RIVE',
    description: "Repenser la mode par le vintage et l'upcycling, à Paris.",
    url: 'https://www.nouvellerive.eu/manifesto',
    type: 'article',
    siteName: 'NOUVELLE RIVE',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Manifesto NOUVELLE RIVE' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Manifesto — NOUVELLE RIVE',
    description: "Repenser la mode par le vintage et l'upcycling, à Paris.",
    images: ['/facade%20paysage.jpg'],
  },
}

export default function ManifestoLayout({ children }: { children: React.ReactNode }) {
  return children
}
