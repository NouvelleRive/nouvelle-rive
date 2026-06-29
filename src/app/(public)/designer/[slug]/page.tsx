import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProductGrid from '@/components/ProductGrid'
import { LUXURY_BRANDS } from '@/lib/admin/helpers'
import { getAllProduitsCached } from '@/lib/getAllProduitsCached'

const BASE_URL = 'https://www.nouvellerive.eu'

export const revalidate = 300

const DIACRITICS = /[̀-ͯ]/g
function slugifyBrand(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isLuxurySlug(slug: string): boolean {
  return LUXURY_BRANDS.some(b => slugifyBrand(b) === slug)
}

function serializeProduit(id: string, raw: any) {
  return {
    id,
    nom: raw.nom || '',
    nomEn: raw.nomEn,
    prix: typeof raw.prix === 'number' ? raw.prix : 0,
    imageUrls: Array.isArray(raw.imageUrls) ? raw.imageUrls : (raw.imageUrl ? [raw.imageUrl] : []),
    marque: raw.marque,
    taille: raw.taille,
    color: raw.color,
    material: raw.material,
    modele: raw.modele,
    motif: raw.motif,
    categorie: typeof raw.categorie === 'string' ? raw.categorie : (raw.categorie?.label || ''),
    vendu: !!raw.vendu,
    promotion: !!raw.promotion,
    sku: raw.sku,
  }
}

async function getProduitsByMarque(slug: string) {
  try {
    const all = await getAllProduitsCached()
    return all
      .filter(({ raw }) =>
        raw.statut !== 'supprime' &&
        raw.statut !== 'retour' &&
        raw.vendu !== true &&
        (raw.quantite ?? 1) > 0 &&
        raw.prix > 0 &&
        (raw.photos?.face || raw.imageUrls?.[0] || raw.imageUrl) &&
        slugifyBrand(raw.marque || '') === slug
      )
      .map(({ id, raw }) => serializeProduit(id, raw))
  } catch (err) {
    console.error('[(public)/designer/[slug]] getProduitsByMarque error:', err)
    return []
  }
}

function prettyBrand(slug: string): string {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const brand = prettyBrand(slug)
  const title = `${brand} vintage — pièces chinées à Paris`
  const description = `Toutes les pièces vintage et seconde main ${brand} sélectionnées par NOUVELLE RIVE, boutique du Marais à Paris. Sacs, vêtements, accessoires ${brand} authentifiés.`
  const url = `${BASE_URL}/designer/${slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: 'NOUVELLE RIVE', locale: 'fr_FR' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function MarquePage({ params }: { params: Params }) {
  const { slug } = await params
  const produits = await getProduitsByMarque(slug)
  if (produits.length === 0) notFound()

  const brand = prettyBrand(slug)
  const isLuxury = isLuxurySlug(slug)

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
          {brand} {isLuxury ? 'vintage de luxe' : 'vintage'}
        </h1>
      </div>
      <div className="w-full border-t border-black" />
      <ProductGrid produits={produits} columns={3} />
    </div>
  )
}
