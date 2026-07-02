import { getInitialProduitsForPage } from '@/lib/produitsServer'
import LuxeClient from './LuxeClient'

export const revalidate = 3600

export default async function LuxePage() {
  const initialProduits = await getInitialProduitsForPage('luxe', 50)
  return <LuxeClient initialProduits={initialProduits} />
}
