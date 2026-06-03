import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { adminDb } from '@/lib/firebaseAdmin'
import ProductGrid from '@/components/ProductGrid'
import { getTypeSlug, getMarqueSlug, SANS_MARQUE } from '@/lib/produitSlug'
import { getTypeShortLabel } from '@/lib/typeLabels'

const BASE_URL = 'https://www.nouvellerive.eu'

export const revalidate = 300

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

async function getProduitsByTypeMarque(type: string, marque: string) {
  try {
    const snap = await adminDb.collection('produits').get()
    const docs = snap.docs
      .map(d => ({ id: d.id, raw: d.data() as any }))
      .filter(({ raw }) =>
        raw.statut !== 'supprime' &&
        raw.statut !== 'retour' &&
        raw.vendu !== true &&
        (raw.quantite ?? 1) > 0 &&
        raw.prix > 0 &&
        (raw.photos?.face || raw.imageUrls?.[0] || raw.imageUrl) &&
        getTypeSlug(raw.categorie) === type &&
        getMarqueSlug(raw.marque) === marque
      )
    let marqueLabel = ''
    if (docs.length > 0 && marque !== SANS_MARQUE) {
      marqueLabel = (docs[0].raw.marque || '').trim()
    }
    return { produits: docs.map(({ id, raw }) => serializeProduit(id, raw)), marqueLabel }
  } catch (err) {
    console.error('[(public)/[type]/[marque]] getProduitsByTypeMarque error:', err)
    return { produits: [], marqueLabel: '' }
  }
}

type Params = Promise<{ type: string; marque: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { type, marque } = await params
  if (marque === SANS_MARQUE) return { title: 'Catégorie introuvable', robots: { index: false } }
  const { marqueLabel } = await getProduitsByTypeMarque(type, marque)
  const typeLabel = getTypeShortLabel(type, 'fr')
  const brandName = marqueLabel || marque.replace(/-/g, ' ')
  const title = `${brandName} ${typeLabel} vintage et upcyclés`
  const description = `${brandName} ${typeLabel} chez NOUVELLE RIVE — pièces vintage et upcyclées chinées à Paris, sélectionnées par des créatrices indépendantes.`
  const url = `${BASE_URL}/${type}/${marque}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: 'NOUVELLE RIVE', locale: 'fr_FR' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function TypeMarquePage({ params }: { params: Params }) {
  const { type, marque } = await params
  if (marque === SANS_MARQUE) notFound()
  const { produits, marqueLabel } = await getProduitsByTypeMarque(type, marque)
  if (produits.length === 0) notFound()

  const typeLabel = getTypeShortLabel(type, 'fr')
  const brandName = marqueLabel || marque.replace(/-/g, ' ')

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="px-6 py-20">
        <h1
          id="titre"
          style={{
            fontSize: 'clamp(32px, 6vw, 80px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 0.95,
            textTransform: 'uppercase',
          }}
        >
          {brandName} — {typeLabel}
        </h1>
      </div>
      <div className="w-full border-t border-black" />
      <ProductGrid produits={produits} columns={3} />
    </div>
  )
}
