import type { Metadata } from 'next'
import BoutiqueListing from '@/components/BoutiqueListing'
import { getCoupsDeCoeurServer } from '@/lib/produitsServer'
import { getCloudinaryUrl, getCloudinarySrcSet, CLOUDINARY_GRID_SIZES } from '@/lib/cloudinary'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Vintage Upcycling Paris',
  description:
    "Boutique vintage et upcycling au cœur du Marais à Paris. Pièces uniques chinées ou designées par des créatrices indépendantes — vintage de luxe, archives, upcycling, créateurs.",
  alternates: { canonical: 'https://www.nouvellerive.eu/' },
  openGraph: {
    title: 'VINTAGE UPCYCLING PARIS | NOUVELLE RIVE',
    description: "Boutique vintage et upcycling au cœur du Marais à Paris. Pièces uniques chinées ou designées par des créatrices indépendantes — vintage de luxe, archives, upcycling, créateurs.",
    url: 'https://www.nouvellerive.eu',
    type: 'website',
    siteName: 'NOUVELLE RIVE',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'NOUVELLE RIVE — Boutique 8 rue des Ecouffes, Le Marais' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VINTAGE UPCYCLING PARIS | NOUVELLE RIVE',
    description: "Boutique vintage et upcycling au cœur du Marais à Paris. Pièces uniques chinées ou designées par des créatrices indépendantes — vintage de luxe, archives, upcycling, créateurs.",
    images: ['/facade%20paysage.jpg'],
  },
}

export default async function HomePage() {
  const initialProduits = await getCoupsDeCoeurServer(50)
  // Précharge les 4 premières vignettes dans le <head> du HTML pour que le navigateur les télécharge
  // avant même de parser le corps de la page (React 19 hisse les <link> dans <head>).
  const preloadImages = initialProduits
    .slice(0, 4)
    .map((p) => p.imageUrls?.[0])
    .filter((u): u is string => !!u)
  return (
    <>
      {preloadImages.map((u) => (
        <link
          key={u}
          rel="preload"
          as="image"
          href={getCloudinaryUrl(u)}
          imageSrcSet={getCloudinarySrcSet(u)}
          imageSizes={CLOUDINARY_GRID_SIZES}
          fetchPriority="high"
        />
      ))}
      <BoutiqueListing
        initialProduits={initialProduits}
        h1Fr="NOS PIÈCES PRÉFÉRÉES"
        h1En="OUR FAVOURITES"
        skipClientRefetch
      />
    </>
  )
}
