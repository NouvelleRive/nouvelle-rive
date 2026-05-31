import CategoryListingClient from '@/components/CategoryListingClient'
import { getInitialProduitsForPage } from '@/lib/produitsServer'

export const revalidate = 60

export default async function HommePage() {
  const initialProduits = await getInitialProduitsForPage('homme', 50)
  return <CategoryListingClient pageId="homme" h1Fr="(PLUTÔT) HOMME" h1En="(SO-CALLED) MEN" initialProduits={initialProduits} />
}
