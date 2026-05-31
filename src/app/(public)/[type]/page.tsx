import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { adminDb } from '@/lib/firebaseAdmin'
import ProductGrid from '@/components/ProductGrid'
import { getTypeSlug } from '@/lib/produitSlug'

const BASE_URL = 'https://www.nouvellerive.eu'

export const revalidate = 300

function capitalize(s: string): string {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function titleForType(type: string): string {
  const pretty = capitalize(type.replace(/-/g, ' '))
  return `Vintage ${pretty} — pièces chinées à Paris`
}

function descriptionForType(type: string): string {
  const pretty = type.replace(/-/g, ' ')
  return `Toutes les pièces vintage et upcyclées catégorie ${pretty} chez NOUVELLE RIVE. Sélection chinée dans notre boutique du Marais à Paris.`
}

async function getProduitsByType(type: string) {
  try {
    const snap = await adminDb.collection('produits').get()
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(p =>
        p.statut !== 'supprime' &&
        p.statut !== 'retour' &&
        p.vendu !== true &&
        (p.quantite ?? 1) > 0 &&
        p.prix > 0 &&
        (p.photos?.face || p.imageUrls?.[0] || p.imageUrl) &&
        getTypeSlug(p.categorie) === type
      )
  } catch (err) {
    console.error('[(public)/[type]] getProduitsByType error:', err)
    return []
  }
}

type Params = Promise<{ type: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { type } = await params
  const title = titleForType(type)
  const description = descriptionForType(type)
  const url = `${BASE_URL}/${type}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: 'NOUVELLE RIVE', locale: 'fr_FR' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function TypePage({ params }: { params: Params }) {
  const { type } = await params
  const produits = await getProduitsByType(type)
  if (produits.length === 0) notFound()

  const pretty = capitalize(type.replace(/-/g, ' '))

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="px-6 py-20">
        <h1
          style={{
            fontSize: 'clamp(40px, 8vw, 120px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 0.9,
            textTransform: 'uppercase',
          }}
        >
          Vintage {pretty}
        </h1>
      </div>
      <div className="w-full border-t border-black" />
      <ProductGrid produits={produits as any} columns={3} />
    </div>
  )
}
