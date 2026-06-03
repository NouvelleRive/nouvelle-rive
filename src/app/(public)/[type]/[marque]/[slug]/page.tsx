import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { adminDb } from '@/lib/firebaseAdmin'
import ProduitClient, { type Produit, type ChineuseInfo } from '../../../boutique/[id]/ProduitClient'
import {
  SEUIL_LIVRAISON_OFFERTE,
  FRAIS_LIVRAISON_FR,
  FRAIS_LIVRAISON_EU,
  FRAIS_LIVRAISON_INTL,
  PAYS_LIVRAISON,
} from '@/lib/shipping'
import { buildProduitPath, extractIdFromSlug, getTypeSlug, getMarqueSlug, SANS_MARQUE } from '@/lib/produitSlug'
import { getTypeShortLabel } from '@/lib/typeLabels'

const BASE_URL = 'https://www.nouvellerive.eu'

const PAYS_RETOURS_GRATUITS = PAYS_LIVRAISON
  .filter(p => p.zone === 'FR' || p.zone === 'EU')
  .map(p => p.code)

function buildShippingDetails(prix: number) {
  const fraisFR = prix >= SEUIL_LIVRAISON_OFFERTE ? 0 : FRAIS_LIVRAISON_FR
  const mkDelivery = (transitMin: number, transitMax: number) => ({
    '@type': 'ShippingDeliveryTime',
    handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
    transitTime: { '@type': 'QuantitativeValue', minValue: transitMin, maxValue: transitMax, unitCode: 'DAY' },
  })
  return [
    {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: fraisFR, currency: 'EUR' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'FR' },
      deliveryTime: mkDelivery(2, 3),
    },
    {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: FRAIS_LIVRAISON_EU, currency: 'EUR' },
      shippingDestination: {
        '@type': 'DefinedRegion',
        addressCountry: PAYS_LIVRAISON.filter(p => p.zone === 'EU').map(p => p.code),
      },
      deliveryTime: mkDelivery(3, 5),
    },
    {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: FRAIS_LIVRAISON_INTL, currency: 'EUR' },
      shippingDestination: {
        '@type': 'DefinedRegion',
        addressCountry: PAYS_LIVRAISON.filter(p => p.zone === 'INTL').map(p => p.code),
      },
      deliveryTime: mkDelivery(5, 10),
    },
  ]
}

const RETURN_POLICY = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: PAYS_RETOURS_GRATUITS,
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 14,
  returnMethod: 'https://schema.org/ReturnByMail',
  returnFees: 'https://schema.org/FreeReturn',
}

export const revalidate = 60

type ProduitDoc = Produit & { chineurUid?: string; chineur?: string }

async function fetchDoc(id: string) {
  const snap = await adminDb.collection('produits').doc(id).get()
  return snap.exists ? snap : null
}

async function getProduit(id: string): Promise<ProduitDoc | null> {
  try {
    let snap = await fetchDoc(id)
    // SKU-format ids are uppercase in Firestore — retry uppercase if direct lookup miss
    if (!snap && /^[A-Za-z]{2,10}\d{1,5}$/.test(id) && id !== id.toUpperCase()) {
      snap = await fetchDoc(id.toUpperCase())
    }
    if (!snap) return null
    const raw = snap.data() as any
    const produit: ProduitDoc = {
      id: snap.id,
      nom: raw.nom,
      nomEn: raw.nomEn,
      prix: raw.prix,
      imageUrls: raw.imageUrls || [],
      sku: raw.sku,
      photos: raw.photos,
      categorie: raw.categorie,
      marque: raw.marque,
      description: raw.description,
      descriptionEn: raw.descriptionEn,
      taille: raw.taille,
      color: raw.color,
      material: raw.material,
      madeIn: raw.madeIn,
      etat: raw.etat,
      composition: raw.composition,
      entretien: raw.entretien,
      vendu: !!raw.vendu,
      videoUrl: raw.videoUrl,
      videos: Array.isArray(raw.videos) ? raw.videos : undefined,
      chineurUid: raw.chineurUid,
      chineur: raw.chineur,
    }
    return produit
  } catch (err) {
    console.error('[(public)/[type]/[marque]/[slug]] getProduit error:', err)
    return null
  }
}

async function getChineuseInfo(produit: ProduitDoc): Promise<ChineuseInfo | null> {
  try {
    let chDoc: FirebaseFirestore.DocumentSnapshot | null = null

    const catRaw = typeof produit.categorie === 'string' ? produit.categorie : (produit.categorie?.label || '')
    const triMatch = catRaw.match(/^([A-Z]{2,10})\s*[-–]/)
    if (triMatch) {
      const snap = await adminDb.collection('chineuse').where('trigramme', '==', triMatch[1]).limit(1).get()
      if (!snap.empty) chDoc = snap.docs[0]
    }
    if (!chDoc && produit.chineurUid) {
      const snap = await adminDb.collection('chineuse').where('authUid', '==', produit.chineurUid).limit(1).get()
      if (!snap.empty) chDoc = snap.docs[0]
    }
    if (!chDoc && produit.chineur) {
      const snap = await adminDb.collection('chineuse').where('email', '==', produit.chineur).limit(1).get()
      if (!snap.empty) chDoc = snap.docs[0]
    }
    if (!chDoc) return null

    const ch = chDoc.data() as any
    return {
      accroche: ch.accroche,
      accrocheEn: ch.accrocheEn,
      description: ch.description,
      descriptionEn: ch.descriptionEn,
      nom: ch.nom,
      texteEcoCirculaire: ch.texteEcoCirculaire || 1,
      stockType: ch.stockType,
      slug: ch.slug,
      trigramme: ch.trigramme,
      authUid: ch.authUid,
    }
  } catch (err) {
    console.error('[(public)/[type]/[marque]/[slug]] getChineuseInfo error:', err)
    return null
  }
}

type SimilarProduit = {
  id: string
  nom: string
  marque?: string
  prix: number
  imageUrl: string | null
  vendu: boolean
  path: string
}

function serializeSimilar(id: string, raw: any): SimilarProduit {
  const imageUrl = raw.photos?.face || (Array.isArray(raw.imageUrls) ? raw.imageUrls[0] : null) || raw.imageUrl || null
  return {
    id,
    nom: raw.nom || '',
    marque: raw.marque,
    prix: typeof raw.prix === 'number' ? raw.prix : 0,
    imageUrl,
    vendu: !!raw.vendu,
    path: buildProduitPath({
      id,
      nom: raw.nom,
      marque: raw.marque,
      color: raw.color,
      taille: raw.taille,
      categorie: raw.categorie,
    }),
  }
}

async function getSimilarProduits(currentId: string, chineuse: ChineuseInfo | null, currentTypeSlug: string): Promise<SimilarProduit[]> {
  try {
    const snap = await adminDb.collection('produits').get()
    const available = snap.docs
      .map(d => ({ id: d.id, raw: d.data() as any }))
      .filter(({ id, raw }) =>
        id !== currentId &&
        raw.statut !== 'supprime' &&
        raw.statut !== 'retour' &&
        raw.vendu !== true &&
        (raw.quantite ?? 1) > 0 &&
        raw.prix > 0 &&
        (raw.photos?.face || raw.imageUrls?.[0] || raw.imageUrl)
      )

    const matchesChineuse = ({ raw }: { raw: any }) => {
      if (!chineuse) return false
      const catRaw = typeof raw.categorie === 'string' ? raw.categorie : (raw.categorie?.label || '')
      const triMatch = catRaw.match(/^([A-Z]{2,10})\s*[-–]/)
      if (chineuse.trigramme && triMatch && triMatch[1] === chineuse.trigramme) return true
      if (chineuse.authUid && raw.chineurUid === chineuse.authUid) return true
      return false
    }

    const sameChineuse = available.filter(matchesChineuse).slice(0, 8)
    if (sameChineuse.length >= 8) return sameChineuse.map(({ id, raw }) => serializeSimilar(id, raw))

    const sameType = available
      .filter(p => !matchesChineuse(p) && getTypeSlug(p.raw.categorie) === currentTypeSlug)
      .slice(0, 8 - sameChineuse.length)

    return [...sameChineuse, ...sameType].map(({ id, raw }) => serializeSimilar(id, raw))
  } catch (err) {
    console.error('[(public)/[type]/[marque]/[slug]] getSimilarProduits error:', err)
    return []
  }
}

function buildTitle(produit: Produit): string {
  const cleanedNom = produit.nom.replace(/^[A-Z]{2,10}\d{1,4}\s*[-–]\s*/i, '').trim()
  return produit.marque ? `${produit.marque} — ${cleanedNom}` : cleanedNom
}

type Params = Promise<{ type: string; marque: string; slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const id = extractIdFromSlug(slug)
  if (!id) return { title: 'Produit introuvable', robots: { index: false } }
  const produit = await getProduit(id)
  if (!produit) return { title: 'Produit introuvable', robots: { index: false } }

  const canonicalPath = buildProduitPath(produit)
  const titleBase = buildTitle(produit)
  const baseDescription = produit.description?.trim() || `${titleBase} — pièce vintage chinée à Paris, sélectionnée par NOUVELLE RIVE.`
  const description = baseDescription.length > 155 ? `${baseDescription.slice(0, 152).trim()}…` : baseDescription

  const image = produit.imageUrls?.[0] || produit.photos?.face || `${BASE_URL}/icon-512.png`
  const url = `${BASE_URL}/${canonicalPath}`
  const ogTitle = `${titleBase} — NOUVELLE RIVE`

  return {
    title: titleBase,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: ogTitle,
      description,
      url,
      type: 'website',
      siteName: 'NOUVELLE RIVE',
      images: [{ url: image, alt: titleBase }],
      locale: 'fr_FR',
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      images: [image],
    },
    robots: produit.vendu ? { index: false } : undefined,
  }
}

export default async function ProduitPage({ params }: { params: Params }) {
  const { type, marque, slug } = await params
  const id = extractIdFromSlug(slug)
  if (!id) notFound()
  const produit = await getProduit(id)
  if (!produit) notFound()

  const canonicalPath = buildProduitPath(produit)
  const requestedPath = `${type}/${marque}/${slug}`
  if (requestedPath !== canonicalPath) {
    permanentRedirect(`/${canonicalPath}`)
  }

  const chineuseInfo = await getChineuseInfo(produit)
  const titleBase = buildTitle(produit)
  const url = `${BASE_URL}/${canonicalPath}`
  const image = produit.imageUrls?.[0] || produit.photos?.face
  const currentTypeSlug = getTypeSlug(produit.categorie)
  const similarProduits = await getSimilarProduits(produit.id, chineuseInfo, currentTypeSlug)

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: titleBase,
    description: produit.description || titleBase,
    sku: produit.sku || produit.id,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'EUR',
      price: produit.prix,
      availability: produit.vendu ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/UsedCondition',
      seller: { '@type': 'Organization', name: 'NOUVELLE RIVE' },
      hasMerchantReturnPolicy: RETURN_POLICY,
      shippingDetails: buildShippingDetails(produit.prix || 0),
    },
  }
  if (image) jsonLd.image = [image]
  jsonLd.brand = { '@type': 'Brand', name: produit.marque || 'Sans marque' }

  const typeSlug = getTypeSlug(produit.categorie)
  const cleanedNom = produit.nom.replace(/^[A-Z]{2,10}\d{1,4}\s*[-–]\s*/i, '').trim()
  const breadcrumbItems: Array<Record<string, unknown>> = [
    { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE_URL + '/' },
  ]
  if (typeSlug && typeSlug !== 'piece') {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: getTypeShortLabel(typeSlug, 'fr'),
      item: `${BASE_URL}/${typeSlug}`,
    })
  }
  if (produit.marque && typeSlug && typeSlug !== 'piece') {
    const marqueSlug = getMarqueSlug(produit.marque)
    if (marqueSlug !== SANS_MARQUE) {
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: breadcrumbItems.length + 1,
        name: produit.marque,
        item: `${BASE_URL}/${typeSlug}/${marqueSlug}`,
      })
    }
  }
  breadcrumbItems.push({
    '@type': 'ListItem',
    position: breadcrumbItems.length + 1,
    name: cleanedNom,
    item: url,
  })
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <ProduitClient
        produit={produit}
        chineuseInfo={chineuseInfo}
        similarProduits={similarProduits}
        currentTypeSlug={currentTypeSlug}
      />
    </>
  )
}
