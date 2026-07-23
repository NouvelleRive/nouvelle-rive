import type { Metadata } from 'next'
import BoutiqueListing from '@/components/BoutiqueListing'
import { getInitialProduitsForPage } from '@/lib/produitsServer'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'SAC — Luxe, Designers, Vintage, Jeune créateurice',
  description:
    "Chanel, Dior, YSL, Bottega, Prada, Gucci, pièces uniques upcyclées — sacs de luxe et créations chinés à Paris.",
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
