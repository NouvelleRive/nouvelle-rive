'use client'

import IconiquesView from '@/components/IconiquesView'

export default function IconiquesUpcyPage() {
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
    />
  )
}
