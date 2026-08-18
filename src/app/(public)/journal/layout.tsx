import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Journal — vintage, dépôt-vente & mode circulaire | NOUVELLE RIVE',
  description:
    "Le Journal de NOUVELLE RIVE : guides sur le vintage, le dépôt-vente de luxe à Paris, l'upcycling et la mode responsable. Conseils pour chiner et bien acheter.",
  alternates: { canonical: 'https://www.nouvellerive.eu/journal' },
  openGraph: {
    title: 'Journal — NOUVELLE RIVE',
    description: "Guides vintage, dépôt-vente de luxe et mode circulaire, depuis le Marais à Paris.",
    url: 'https://www.nouvellerive.eu/journal',
    type: 'website',
    siteName: 'NOUVELLE RIVE',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Journal NOUVELLE RIVE' }],
    locale: 'fr_FR',
  },
}

export default function JournalLayout({ children }: { children: React.ReactNode }) {
  return children
}
