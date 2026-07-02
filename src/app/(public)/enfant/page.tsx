import CategoryListingClient from '@/components/CategoryListingClient'
import { getInitialProduitsForPage } from '@/lib/produitsServer'

export const revalidate = 3600

export default async function EnfantPage() {
  const initialProduits = await getInitialProduitsForPage('enfant', 50)
  return <CategoryListingClient pageId="enfant" h1Fr="ENFANT" h1En="KIDS" initialProduits={initialProduits} />
}
