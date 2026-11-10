import CategoryListingClient from '@/components/CategoryListingClient'
import { getInitialProduitsForPage } from '@/lib/produitsServer'

export const revalidate = 3600

export default async function HiverPage() {
  const initialProduits = await getInitialProduitsForPage('hiver', 50)
  return <CategoryListingClient pageId="hiver" h1Fr="HIVER" h1En="WINTER" initialProduits={initialProduits} />
}
