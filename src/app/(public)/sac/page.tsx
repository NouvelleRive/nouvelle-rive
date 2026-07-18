import type { Metadata } from 'next'
import BoutiqueListing from '@/components/BoutiqueListing'
import { getInitialProduitsForPage } from '@/lib/produitsServer'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Sacs haute couture et jeunes créatrices — Nouvelle Rive',
  description:
    "Sélection de sacs vintage de luxe et de sacs upcyclés par nos jeunes créatrices, chinés à Paris. 8 rue des Écouffes.",
  alternates: { canonical: 'https://www.nouvellerive.eu/sac' },
}

// /sac utilise désormais le même moteur de filtre que les autres pages (siteConfig + rules
// via getInitialProduitsForPage / useFilteredProducts). Rules éditables sur /admin/site.
export default async function SacPage() {
  const initialProduits = await getInitialProduitsForPage('sac', 60)
  return (
    <BoutiqueListing
      initialProduits={initialProduits}
      pageId="sac"
      h1Fr="SACS HAUTE COUTURE ET JEUNES CRÉATRICES"
      h1En="HAUTE COUTURE & YOUNG DESIGNER BAGS"
    />
  )
}
