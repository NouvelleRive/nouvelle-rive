import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { adminDb } from '@/lib/firebaseAdmin'
import ProduitClient, { type Produit, type ChineuseInfo } from './ProduitClient'
import {
  SEUIL_LIVRAISON_OFFERTE,
  FRAIS_LIVRAISON_FR,
  FRAIS_LIVRAISON_EU,
  FRAIS_LIVRAISON_INTL,
  PAYS_LIVRAISON,
} from '@/lib/shipping'

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

async function getProduit(id: string): Promise<ProduitDoc | null> {
  try {
    const snap = await adminDb.collection('produits').doc(id).get()
    if (!snap.exists) return null
    const raw = snap.data() as any
    // Ne passer que les champs sérialisables utilisés côté client (pas de Timestamp)
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
    console.error('[boutique/[id]] getProduit error:', err)
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
    }
  } catch (err) {
    console.error('[boutique/[id]] getChineuseInfo error:', err)
    return null
  }
}

function buildTitle(produit: Produit): string {
  const cleanedNom = produit.nom.replace(/^[A-Z]{2,10}\d{1,4}\s*[-–]\s*/i, '').trim()
  return produit.marque ? `${produit.marque} — ${cleanedNom}` : cleanedNom
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const produit = await getProduit(id)
  if (!produit) {
    return { title: 'Produit introuvable', robots: { index: false } }
  }

  const titleBase = buildTitle(produit)
  const baseDescription = produit.description?.trim() || `${titleBase} — pièce vintage chinée à Paris, sélectionnée par NOUVELLE RIVE.`
  const description = baseDescription.length > 155 ? `${baseDescription.slice(0, 152).trim()}…` : baseDescription

  const image = produit.imageUrls?.[0] || produit.photos?.face || `${BASE_URL}/icon-512.png`
  const url = `${BASE_URL}/boutique/${produit.id}`
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

export default async function ProduitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const produit = await getProduit(id)
  if (!produit) notFound()

  const chineuseInfo = await getChineuseInfo(produit)

  const titleBase = buildTitle(produit)
  const url = `${BASE_URL}/boutique/${produit.id}`
  const image = produit.imageUrls?.[0] || produit.photos?.face

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
  if (produit.marque) jsonLd.brand = { '@type': 'Brand', name: produit.marque }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProduitClient produit={produit} chineuseInfo={chineuseInfo} />
    </>
  )
}
