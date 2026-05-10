'use client'

import { useParams } from 'next/navigation'
import IconiquesView from '@/components/IconiquesView'

export default function IconiqueVintageDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug

  return (
    <IconiquesView
      typeFilter="vintage"
      titleFr={<>LES ICONIQUES<br />DU VINTAGE</>}
      titleEn={<>VINTAGE<br />ICONICS</>}
      loadingFr="Chargement des iconiques..."
      loadingEn="Loading icons..."
      emptyFr="Aucun produit iconique pour le moment"
      emptyEn="No iconic pieces yet"
      initialSlug={slug}
    />
  )
}
