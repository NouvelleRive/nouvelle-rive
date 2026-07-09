import type { Metadata } from 'next'
import BoutiqueListing from '@/components/BoutiqueListing'
import { getInitialProduitsForPage } from '@/lib/produitsServer'
import { getCloudinaryUrl, getCloudinarySrcSet, CLOUDINARY_GRID_SIZES } from '@/lib/cloudinary'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Vintage et upcyclé chinés à Paris',
  description:
    "Boutique vintage et upcyclée au cœur du Marais à Paris. Pièces uniques chinées par des créatrices indépendantes — vintage de luxe, upcycling, créateurs. 8 rue des Ecouffes, 75004 Paris.",
  alternates: { canonical: 'https://www.nouvellerive.eu/' },
  openGraph: {
    title: 'NOUVELLE RIVE — Vintage et upcyclé chinés à Paris',
    description: "Boutique vintage et upcyclée au cœur du Marais à Paris.",
    url: 'https://www.nouvellerive.eu',
    type: 'website',
    siteName: 'NOUVELLE RIVE',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'NOUVELLE RIVE — Boutique 8 rue des Ecouffes, Le Marais' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NOUVELLE RIVE — Vintage et upcyclé chinés à Paris',
    description: "Boutique vintage et upcyclée au cœur du Marais à Paris.",
    images: ['/facade%20paysage.jpg'],
  },
}

export default async function HomePage() {
  const initialProduits = await getInitialProduitsForPage('ete', 50)
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
        pageId="ete"
        h1Fr="ÉTÉ"
        h1En="SUMMER"
      />
    </>
  )
}
