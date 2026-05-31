import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { adminDb } from '@/lib/firebaseAdmin'
import ProductGrid from '@/components/ProductGrid'
import TypeH1Title from '@/components/TypeH1Title'
import { getTypeSlug } from '@/lib/produitSlug'

const BASE_URL = 'https://www.nouvellerive.eu'

export const revalidate = 300

// Libellés humains par type (FR correct, pluriel + accords masculin/féminin).
// Si un type n'est pas listé, on tombe sur un fallback générique masculin.
const TYPE_H1: Record<string, string> = {
  haut: 'Hauts vintage et upcyclés',
  'veste-manteau': 'Vestes & manteaux vintage et upcyclés',
  robe: 'Robes vintage et upcyclées',
  'jupe-short': 'Jupes & shorts vintage et upcyclés',
  jupe: 'Jupes vintage et upcyclées',
  short: 'Shorts vintage et upcyclés',
  pantalon: 'Pantalons vintage et upcyclés',
  pull: 'Pulls vintage et upcyclés',
  'pull-gilet': 'Pulls & gilets vintage et upcyclés',
  'gilet-pull': 'Gilets & pulls vintage et upcyclés',
  chemise: 'Chemises vintage et upcyclées',
  ensemble: 'Ensembles vintage et upcyclés',
  combinaison: 'Combinaisons vintage et upcyclées',
  sac: 'Sacs vintage et upcyclés',
  portefeuille: 'Portefeuilles vintage et upcyclés',
  chaussures: 'Chaussures vintage et upcyclées',
  ceinture: 'Ceintures vintage et upcyclées',
  chapeau: 'Chapeaux vintage et upcyclés',
  casquette: 'Casquettes vintage et upcyclées',
  echarpe: 'Écharpes vintage et upcyclées',
  foulard: 'Foulards vintage et upcyclés',
  gants: 'Gants vintage et upcyclés',
  lunettes: 'Lunettes vintage et upcyclées',
  accessoires: 'Accessoires vintage et upcyclés',
  vase: 'Vases vintage et upcyclés',
  bague: 'Bagues vintage et upcyclées',
  collier: 'Colliers vintage et upcyclés',
  bracelet: 'Bracelets vintage et upcyclés',
  'boucles-d-oreilles': "Boucles d'oreilles vintage et upcyclées",
  broche: 'Broches vintage et upcyclées',
  broches: 'Broches vintage et upcyclées',
  charms: 'Charms vintage et upcyclés',
  earcuff: 'Earcuffs vintage et upcyclés',
  piercing: 'Piercings vintage et upcyclés',
  'bijou-de-cravates-et-foulards': 'Bijoux de cravate & foulard vintage et upcyclés',
  'porte-briquet': 'Porte-briquets vintage et upcyclés',
}

const TYPE_H1_EN: Record<string, string> = {
  haut: 'Vintage & upcycled tops',
  'veste-manteau': 'Vintage & upcycled jackets and coats',
  robe: 'Vintage & upcycled dresses',
  'jupe-short': 'Vintage & upcycled skirts and shorts',
  jupe: 'Vintage & upcycled skirts',
  short: 'Vintage & upcycled shorts',
  pantalon: 'Vintage & upcycled pants',
  pull: 'Vintage & upcycled sweaters',
  'pull-gilet': 'Vintage & upcycled sweaters and cardigans',
  'gilet-pull': 'Vintage & upcycled cardigans and sweaters',
  chemise: 'Vintage & upcycled shirts',
  ensemble: 'Vintage & upcycled sets',
  combinaison: 'Vintage & upcycled jumpsuits',
  sac: 'Vintage & upcycled bags',
  portefeuille: 'Vintage & upcycled wallets',
  chaussures: 'Vintage & upcycled shoes',
  ceinture: 'Vintage & upcycled belts',
  chapeau: 'Vintage & upcycled hats',
  casquette: 'Vintage & upcycled caps',
  echarpe: 'Vintage & upcycled scarves',
  foulard: 'Vintage & upcycled silk scarves',
  gants: 'Vintage & upcycled gloves',
  lunettes: 'Vintage & upcycled glasses',
  accessoires: 'Vintage & upcycled accessories',
  vase: 'Vintage & upcycled vases',
  bague: 'Vintage & upcycled rings',
  collier: 'Vintage & upcycled necklaces',
  bracelet: 'Vintage & upcycled bracelets',
  'boucles-d-oreilles': 'Vintage & upcycled earrings',
  broche: 'Vintage & upcycled brooches',
  broches: 'Vintage & upcycled brooches',
  charms: 'Vintage & upcycled charms',
  earcuff: 'Vintage & upcycled ear cuffs',
  piercing: 'Vintage & upcycled piercings',
  'bijou-de-cravates-et-foulards': 'Vintage & upcycled tie and scarf jewelry',
  'porte-briquet': 'Vintage & upcycled lighter holders',
}

function fallbackLabel(type: string): string {
  const pretty = type.replace(/-/g, ' ')
  return `${pretty.charAt(0).toUpperCase() + pretty.slice(1)} vintage et upcyclés`
}
function fallbackLabelEn(type: string): string {
  const pretty = type.replace(/-/g, ' ')
  return `Vintage & upcycled ${pretty}`
}

function labelForType(type: string): string {
  return TYPE_H1[type] || fallbackLabel(type)
}
function labelForTypeEn(type: string): string {
  return TYPE_H1_EN[type] || fallbackLabelEn(type)
}

function titleForType(type: string): string {
  return `${labelForType(type)} chinés à Paris`
}

function descriptionForType(type: string): string {
  return `${labelForType(type)} chez NOUVELLE RIVE, boutique du Marais à Paris. Sélection chinée par des créatrices indépendantes, pièces uniques.`
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

async function getProduitsByType(type: string) {
  try {
    const snap = await adminDb.collection('produits').get()
    return snap.docs
      .map(d => ({ id: d.id, raw: d.data() as any }))
      .filter(({ raw }) =>
        raw.statut !== 'supprime' &&
        raw.statut !== 'retour' &&
        raw.vendu !== true &&
        (raw.quantite ?? 1) > 0 &&
        raw.prix > 0 &&
        (raw.photos?.face || raw.imageUrls?.[0] || raw.imageUrl) &&
        getTypeSlug(raw.categorie) === type
      )
      .map(({ id, raw }) => serializeProduit(id, raw))
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

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="px-6 py-20">
        <TypeH1Title fr={labelForType(type)} en={labelForTypeEn(type)} />
      </div>
      <div className="w-full border-t border-black" />
      <ProductGrid produits={produits} columns={3} />
    </div>
  )
}
