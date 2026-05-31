import CategoryListingClient from '@/components/CategoryListingClient'
import { getInitialProduitsForPage } from '@/lib/produitsServer'

export const revalidate = 60

export default async function FemmePage() {
  const initialProduits = await getInitialProduitsForPage('femme', 50)
  return <CategoryListingClient pageId="femme" h1Fr="(PLUTÔT) FEMME" h1En="(SO-CALLED) WOMEN" initialProduits={initialProduits} />
}
