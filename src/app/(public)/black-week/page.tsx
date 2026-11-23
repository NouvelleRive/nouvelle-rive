import type { Metadata } from 'next'
import BoutiqueListing from '@/components/BoutiqueListing'
import { getAllBoutiqueProduitsServer } from '@/lib/produitsServer'

export const revalidate = 21600

export const metadata: Metadata = {
  title: 'BLACK WEEK — pièces vintage en réduction',
  description: 'Black Week NOUVELLE RIVE : vintage, archives, designers et luxe à prix réduit, jusqu’au 29 novembre.',
  alternates: { canonical: 'https://www.nouvellerive.eu/black-week' },
}

// Pièces remisées par l'opération en cours (lib/remiseOperation), même source
// cachée que /boutique (0 read Firestore).
export default async function BlackWeekPage() {
  const all = await getAllBoutiqueProduitsServer()
  const remisees = all.filter(p => ((p as { remiseBlackWeek?: number }).remiseBlackWeek ?? 0) > 0)
  return (
    <BoutiqueListing
      initialProduits={remisees.slice(0, 60)}
      allBoutiqueMode
      remiseOnly
      h1Fr="BLACK WEEK"
      h1En="BLACK WEEK"
    />
  )
}
