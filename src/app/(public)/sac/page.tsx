import type { Metadata } from 'next'
import BoutiqueListing from '@/components/BoutiqueListing'
import { getSacsHauteCoutureProduits } from '@/lib/produitsServer'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Sacs haute couture et jeunes créatrices — Nouvelle Rive',
  description:
    "Sélection de sacs vintage de luxe et de sacs upcyclés par nos jeunes créatrices, chinés à Paris. 8 rue des Écouffes.",
  alternates: { canonical: 'https://www.nouvellerive.eu/sac' },
}

export default async function SacPage() {
  // Filtre custom (règles LUXE union chineuses petite série) non représentable via siteConfig,
  // donc on rend uniquement les produits SSR et on skip le refetch client.
  const initialProduits = await getSacsHauteCoutureProduits(50)
  return (
    <BoutiqueListing
      initialProduits={initialProduits}
      pageId="sac"
      h1Fr="SACS HAUTE COUTURE ET JEUNES CRÉATRICES"
      h1En="HAUTE COUTURE & YOUNG DESIGNER BAGS"
      skipClientRefetch
    />
  )
}
