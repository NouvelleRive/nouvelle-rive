'use client'

import IconiquesView from '@/components/IconiquesView'

export default function LesIconiquesPage() {
  return (
    <IconiquesView
      collectionName="iconiques"
      titleFr={<>LES ICONIQUES<br />DU VINTAGE</>}
      titleEn={<>VINTAGE<br />ICONICS</>}
      loadingFr="Chargement des iconiques..."
      loadingEn="Loading icons..."
      emptyFr="Aucun produit iconique pour le moment"
      emptyEn="No iconic pieces yet"
    />
  )
}
