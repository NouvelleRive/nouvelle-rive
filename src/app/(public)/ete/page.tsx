import CategoryListingClient from '@/components/CategoryListingClient'
import { getInitialProduitsForPage } from '@/lib/produitsServer'

export const revalidate = 3600

export default async function EtePage() {
  const initialProduits = await getInitialProduitsForPage('ete', 50)
  return <CategoryListingClient pageId="ete" h1Fr="ÉTÉ" h1En="SUMMER" initialProduits={initialProduits} />
}
