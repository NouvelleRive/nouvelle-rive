import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProductGrid from '@/components/ProductGrid'
import { getTypeSlug, getMarqueSlug, SANS_MARQUE } from '@/lib/produitSlug'
import { getTypeShortLabel } from '@/lib/typeLabels'
import { getAllProduitsCached } from '@/lib/getAllProduitsCached'

const BASE_URL = 'https://www.nouvellerive.eu'

export const revalidate = 43200

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

// Les pièces vendues restent visibles 3 semaines avec badge "Vendu" (cf. siteConfig.ts).
const TROIS_SEMAINES_MS = 21 * 24 * 60 * 60 * 1000

function getDateVenteMs(raw: any): number | null {
  const dv = raw.dateVente
  if (!dv) return null
  if (typeof dv.toMillis === 'function') return dv.toMillis()
  if (typeof dv === 'string') return new Date(dv).getTime()
  if (dv?.seconds) return dv.seconds * 1000
  return null
}

async function getProduitsByTypeMarque(type: string, marque: string) {
  try {
    const all = await getAllProduitsCached()
    const seuilVendu = Date.now() - TROIS_SEMAINES_MS
    const docs = all
      .filter(({ raw }) => {
        if (raw.statut === 'supprime' || raw.statut === 'retour') return false
        if (!(raw.prix > 0)) return false
        if (!(raw.photos?.face || raw.imageUrls?.[0] || raw.imageUrl)) return false
        if (getTypeSlug(raw.categorie) !== type) return false
        if (getMarqueSlug(raw.marque) !== marque) return false
        if (raw.vendu === true) {
          const dvMs = getDateVenteMs(raw)
          return dvMs !== null && dvMs >= seuilVendu
        }
        return (raw.quantite ?? 1) > 0
      })
    docs.sort((a, b) => Number(!!a.raw.vendu) - Number(!!b.raw.vendu))
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
