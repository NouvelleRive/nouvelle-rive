import type { Metadata } from 'next'
import BoutiqueListing from '@/components/BoutiqueListing'
import { getAllBoutiqueProduitsServer } from '@/lib/produitsServer'

export const revalidate = 21600

export const metadata: Metadata = {
  title: 'SÉLECTION EN BOUTIQUE — Vintage, Archives, Designers, Luxe, Y2K, 80s, 90s, Upcycling, Régénéré',
  description:
    "Prêt-à-porter, maroquinerie, bijouterie, souliers — vintage, archives, designers, luxe, Y2K, 80s, 90s, upcycling et régénéré chez NOUVELLE RIVE.",
  alternates: { canonical: 'https://www.nouvellerive.eu/boutique' },
}

export default async function BoutiquePage() {
  // Même source (cache blob 6h) que l'API client : 0 read Firestore pour le SSR aussi.
  const all = await getAllBoutiqueProduitsServer()
  return (
    <BoutiqueListing
      initialProduits={all.slice(0, 60)}
      allBoutiqueMode
      h1Fr="TOUTES NOS PIÈCES"
      h1En="ALL OUR PIECES"
    />
  )
}
