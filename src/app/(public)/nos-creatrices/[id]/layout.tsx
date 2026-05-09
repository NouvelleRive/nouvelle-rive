import type { Metadata } from 'next'
import { adminDb } from '@/lib/firebaseAdmin'

const BASE_URL = 'https://www.nouvellerive.eu'

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params

  try {
    const snap = await adminDb.collection('chineuse').doc(id).get()
    if (!snap.exists) {
      return { title: 'Créatrice introuvable', robots: { index: false } }
    }

    const data = snap.data() as any
    const nom = (data.nom || id).trim()
    const accroche = (data.accroche || '').trim()
    const description = (data.description || '').trim()
    const specialite = (data.specialite || '').trim()

    const baseDesc =
      accroche ||
      (description ? description.split(/[.!?]/)[0].trim() : '') ||
      `${nom} — créatrice et chineuse vintage chez Nouvelle Rive. Sa sélection de pièces vintage et upcyclées à Paris, chinées avec amour.`
    const cleanDesc = baseDesc.length > 155 ? baseDesc.slice(0, 152).trim() + '…' : baseDesc

    const url = `${BASE_URL}/nos-creatrices/${id}`
    const image = data.imageUrl || `${BASE_URL}/facade%20paysage.jpg`

    const titleSuffix = specialite ? ` — ${specialite}` : ' — Vintage et upcyclé'

    return {
      title: `${nom}${titleSuffix}`,
      description: cleanDesc,
      alternates: { canonical: url },
      openGraph: {
        title: `${nom} — Nouvelle Rive`,
        description: cleanDesc,
        url,
        type: 'profile',
        siteName: 'Nouvelle Rive',
        images: [{ url: image, alt: `${nom} — créatrice Nouvelle Rive` }],
        locale: 'fr_FR',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${nom} — Nouvelle Rive`,
        description: cleanDesc,
        images: [image],
      },
    }
  } catch (err) {
    console.error('[nos-creatrices/[id]] generateMetadata error:', err)
    return {}
  }
}

export default function CreatriceLayout({ children }: { children: React.ReactNode }) {
  return children
}
