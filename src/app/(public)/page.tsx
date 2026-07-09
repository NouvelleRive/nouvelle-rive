import type { Metadata } from 'next'
import BoutiqueListing from '@/components/BoutiqueListing'
import { getInitialProduitsForPage } from '@/lib/produitsServer'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Vintage et upcyclé chinés à Paris',
  description:
    "Boutique vintage et upcyclée au cœur du Marais à Paris. Pièces uniques chinées par des créatrices indépendantes — vintage de luxe, upcycling, créateurs. 8 rue des Ecouffes, 75004 Paris.",
  alternates: { canonical: 'https://www.nouvellerive.eu/' },
  openGraph: {
    title: 'NOUVELLE RIVE — Vintage et upcyclé chinés à Paris',
    description: "Boutique vintage et upcyclée au cœur du Marais à Paris.",
    url: 'https://www.nouvellerive.eu',
    type: 'website',
    siteName: 'NOUVELLE RIVE',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'NOUVELLE RIVE — Boutique 8 rue des Ecouffes, Le Marais' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NOUVELLE RIVE — Vintage et upcyclé chinés à Paris',
    description: "Boutique vintage et upcyclée au cœur du Marais à Paris.",
    images: ['/facade%20paysage.jpg'],
  },
}

export default async function HomePage() {
  const initialProduits = await getInitialProduitsForPage('ete', 50)
  return (
    <BoutiqueListing
      initialProduits={initialProduits}
      pageId="ete"
      h1Fr="ÉTÉ"
      h1En="SUMMER"
    />
  )
}
