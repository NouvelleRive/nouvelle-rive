import type { Metadata } from 'next'
import BoutiqueListing from '@/components/BoutiqueListing'
import { getRecentProduitsServer } from '@/lib/produitsServer'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Toute la boutique — Vintage et upcyclé chinés à Paris',
  description:
    "Toutes les pièces uniques chinées par nos créatrices indépendantes — vintage de luxe, upcycling, créateurs. Boutique au 8 rue des Ecouffes, Paris.",
  alternates: { canonical: 'https://www.nouvellerive.eu/boutique' },
}

export default async function BoutiquePage() {
  const initialProduits = await getRecentProduitsServer(50)
  return <BoutiqueListing initialProduits={initialProduits} />
}
