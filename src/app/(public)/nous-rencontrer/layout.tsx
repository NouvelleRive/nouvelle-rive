import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '8 RUE DES ECOUFFES — Boutique cœur Marais',
  description:
    "Boutique spacieuse, réassorts tous les jours, ouvert 7/7 11h-20h, dépôt-vente sur rdv. 8 rue des Ecouffes, 75004 Paris.",
  alternates: { canonical: 'https://www.nouvellerive.eu/nous-rencontrer' },
  openGraph: {
    title: '8 RUE DES ECOUFFES — Boutique cœur Marais | NOUVELLE RIVE',
    description: 'Boutique spacieuse, réassorts tous les jours, ouvert 7/7 11h-20h, dépôt-vente sur rdv. 8 rue des Ecouffes, 75004 Paris.',
    url: 'https://www.nouvellerive.eu/nous-rencontrer',
    type: 'website',
    siteName: 'NOUVELLE RIVE',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Boutique NOUVELLE RIVE — 8 rue des Ecouffes, Le Marais' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: '8 RUE DES ECOUFFES — Boutique cœur Marais | NOUVELLE RIVE',
    description: 'Ouvert 7/7 11h-20h, dépôt-vente sur rdv. 8 rue des Ecouffes, 75004 Paris.',
    images: ['/facade%20paysage.jpg'],
  },
}

export default function NousRencontrerLayout({ children }: { children: React.ReactNode }) {
  return children
}
