import type { Metadata } from 'next'
import BoutiqueListing from '@/components/BoutiqueListing'
import { getAllBoutiqueProduitsServer } from '@/lib/produitsServer'

export const revalidate = 21600

export const metadata: Metadata = {
  title: 'Toute la boutique — Vintage et upcyclé chinés à Paris',
  description:
    "Toutes les pièces uniques chinées par nos créatrices indépendantes — vintage de luxe, upcycling, créateurs. Boutique au 8 rue des Ecouffes, Paris.",
  alternates: { canonical: 'https://www.nouvellerive.eu/boutique' },
}

export default async function BoutiquePage() {
  // Même source (cache blob 6h) que l'API client : 0 read Firestore pour le SSR aussi.
  const all = await getAllBoutiqueProduitsServer()
  return <BoutiqueListing initialProduits={all.slice(0, 60)} allBoutiqueMode />
}
