import type { Metadata } from 'next'
import { getChineusesLiteCached } from '@/lib/getChineusesLiteCached'

const BASE_URL = 'https://www.nouvellerive.eu'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params

  try {
    // Résolution en mémoire depuis le cache mutualisé — 0 read Firestore par visite.
    const chineuses = await getChineusesLiteCached()
    const data = chineuses.find(c => c.uid === id || c.slug === id)
    if (!data) {
      return { title: 'Créatrice introuvable', robots: { index: false } }
    }

    const nom = (data.nom || id).trim()
    const accroche = (data.accroche || '').trim()
    const description = (data.description || '').trim()
    const specialite = (data.specialite || '').trim()

    const baseDesc =
      accroche ||
      (description ? description.split(/[.!?]/)[0].trim() : '') ||
      `${nom} — créatrice et chineuse vintage chez NOUVELLE RIVE. Sa sélection de pièces vintage et upcyclées à Paris, chinées avec amour.`
    const cleanDesc = baseDesc.length > 155 ? baseDesc.slice(0, 152).trim() + '…' : baseDesc

    const url = `${BASE_URL}/nos-creatrices/${id}`
    const image = data.imageUrl || `${BASE_URL}/facade%20paysage.jpg`

    const titleSuffix = specialite ? ` — ${specialite}` : ' — Vintage et upcyclé'

    return {
      title: `${nom}${titleSuffix}`,
      description: cleanDesc,
      alternates: { canonical: url },
      openGraph: {
        title: `${nom} — NOUVELLE RIVE`,
        description: cleanDesc,
        url,
        type: 'profile',
        siteName: 'NOUVELLE RIVE',
        images: [{ url: image, alt: `${nom} — créatrice NOUVELLE RIVE` }],
        locale: 'fr_FR',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${nom} — NOUVELLE RIVE`,
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
