import { notFound, permanentRedirect } from 'next/navigation'
import { adminDb } from '@/lib/firebaseAdmin'
import { buildProduitSlug } from '@/lib/produitSlug'

export const revalidate = 60

export default async function BoutiqueIdRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let slug: string | null = null
  try {
    const snap = await adminDb.collection('produits').doc(id).get()
    if (snap.exists) {
      const raw = snap.data() as any
      slug = buildProduitSlug({
        id: snap.id,
        nom: raw.nom,
        marque: raw.marque,
        color: raw.color,
        taille: raw.taille,
        categorie: raw.categorie,
      })
    }
  } catch (err) {
    console.error('[boutique/[id]] redirect lookup error:', err)
  }
  if (!slug) notFound()
  permanentRedirect(`/${slug}`)
}
