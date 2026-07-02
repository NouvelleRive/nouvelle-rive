import CategoryListingClient from '@/components/CategoryListingClient'
import { getInitialProduitsForPage } from '@/lib/produitsServer'

export const revalidate = 3600

export default async function AccessoiresPage() {
  const initialProduits = await getInitialProduitsForPage('accessoires', 50)
  return <CategoryListingClient pageId="accessoires" h1Fr="ACCESSOIRES" h1En="ACCESSORIES" initialProduits={initialProduits} />
}
