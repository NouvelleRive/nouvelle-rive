'use client'

import { useParams } from 'next/navigation'
import IconiquesView from '@/components/IconiquesView'

export default function IconiqueUpcyDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug

  return (
    <IconiquesView
      typeFilter="upcy"
      titleFr={<>NOS PIÈCES UPCY<br />FAVORITES</>}
      titleEn={<>OUR FAVORITE<br />UPCYCLED PIECES</>}
      loadingFr="Chargement des pièces upcyclées..."
      loadingEn="Loading upcycled pieces..."
      emptyFr="Aucune pièce upcyclée pour le moment"
      emptyEn="No upcycled pieces yet"
      showMarketBlock={false}
      initialSlug={slug}
    />
  )
}
