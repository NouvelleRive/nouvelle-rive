import CategoryListingClient from '@/components/CategoryListingClient'
import { getInitialProduitsForPage } from '@/lib/produitsServer'

export const revalidate = 3600

export default async function SoireePage() {
  const initialProduits = await getInitialProduitsForPage('soiree', 50)
  return <CategoryListingClient pageId="soiree" h1Fr="SOIRÉE" h1En="EVENING" initialProduits={initialProduits} />
}
