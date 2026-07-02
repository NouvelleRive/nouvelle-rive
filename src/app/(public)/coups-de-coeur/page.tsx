import { getCoupsDeCoeurServer } from '@/lib/produitsServer'
import CoupsDeCoeurClient from './CoupsDeCoeurClient'

export const revalidate = 3600

export default async function CoupsDeCoeurPage() {
  const initialProduits = await getCoupsDeCoeurServer(50)
  return <CoupsDeCoeurClient initialProduits={initialProduits} />
}
