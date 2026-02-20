// lib/ebay/publish.ts

/**
 * Fonctions pour publier des produits sur eBay
 */

import { ebayApiCall, calculateEbayPrice, isEbayConfigured } from './clients'
import { findEbayCategory, estimateShippingByCategory } from './categories'
import { EbayProduct, EbayListingResponse } from './types'

const EBAY_MARKETPLACE_ID = 'EBAY_US'
const EBAY_CURRENCY = 'USD'
const EBAY_MERCHANT_LOCATION_KEY = process.env.EBAY_MERCHANT_LOCATION_KEY || 'PARIS_STORE'

// Flag pour s'assurer que la location est créée une seule fois
let locationInitialized = false

/**
 * S'assure que la location marchande existe (appelé automatiquement)
 */
async function ensureMerchantLocation(): Promise<void> {
  if (locationInitialized) return

  try {
    const locationKey = EBAY_MERCHANT_LOCATION_KEY

    const locationData = {
      location: {
        address: {
          city: 'Paris',
          postalCode: '75004',
          country: 'FR',
        },
      },
      name: 'Nouvelle Rive - Le Marais',
      merchantLocationStatus: 'ENABLED',
      locationTypes: ['STORE'],
    }

    await ebayApiCall(`/sell/inventory/v1/location/${locationKey}`, {
      method: 'POST',
      body: locationData,
    })

    console.log(`✅ Location eBay créée: ${locationKey}`)
  } catch (error: any) {
    // Si la location existe déjà, ce n'est pas une erreur
    if (error?.message?.includes('already exists') || error?.message?.includes('Location already exists')) {
      console.log(`ℹ️ Location eBay existe déjà: ${EBAY_MERCHANT_LOCATION_KEY}`)
    } else {
      console.warn(`⚠️ Erreur création location eBay: ${error?.message}`)
    }
  }

  locationInitialized = true
}

/**
 * Prépare le titre pour eBay (max 80 caractères)
 */
function formatEbayTitle(nom: string, marque?: string): string {
  let title = nom
  
  // Ajouter la marque si pas déjà dans le nom
  if (marque && !nom.toLowerCase().includes(marque.toLowerCase())) {
    title = `${marque} ${nom}`
  }
  
  // Enlever le SKU du début (ex: "GIGI18 - ")
  title = title.replace(/^[A-Z]{2,4}\d+\s*-\s*/i, '')
  
  // Ajouter "Vintage" si pas présent
  if (!title.toLowerCase().includes('vintage')) {
    title = `Vintage ${title}`
  }
  
  // Tronquer à 80 caractères
  if (title.length > 80) {
    title = title.substring(0, 77) + '...'
  }
  
  return title
}

/**
 * Prépare la description HTML pour eBay
 */
function formatEbayDescription(description: string, produit: Partial<EbayProduct>): string {
  const parts: string[] = []
  
  parts.push('<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">')
  parts.push('<h2 style="color: #22209C;">Vintage from Paris</h2>')
  
  if (description) {
    parts.push(`<p>${description}</p>`)
  }
  
  parts.push('<h3>Details</h3>')
  parts.push('<ul>')
  
  if (produit.brand) {
    parts.push(`<li><strong>Brand:</strong> ${produit.brand}</li>`)
  }
  if (produit.material) {
    parts.push(`<li><strong>Material:</strong> ${produit.material}</li>`)
  }
  if (produit.color) {
    parts.push(`<li><strong>Color:</strong> ${produit.color}</li>`)
  }
  if (produit.size) {
    parts.push(`<li><strong>Size:</strong> ${produit.size}</li>`)
  }
  
  parts.push('<li><strong>Condition:</strong> Very Good - Vintage piece in excellent condition</li>')
  parts.push('<li><strong>Origin:</strong> Curated vintage from Paris, France</li>')
  parts.push('</ul>')
  
  parts.push('<h3>Shipping</h3>')
  parts.push('<p>Shipped from Paris, France with tracking. Dispatched within 1-2 business days.</p>')
  
  parts.push('<h3>About Nouvelle Rive</h3>')
  parts.push('<p>We are a vintage boutique in Le Marais, Paris. Every piece is carefully selected for quality and authenticity.</p>')
  
  parts.push('</div>')
  
  return parts.join('\n')
}

/**
 * Construit les aspects (attributs) du produit
 */
function buildProductAspects(produit: EbayProduct): Record<string, string[]> {
  const aspects: Record<string, string[]> = {}
  
  aspects['Brand'] = [produit.brand || 'Unbranded']
  
  if (produit.color) {
    aspects['Color'] = [produit.color]
  }
  if (produit.material) {
    aspects['Material'] = [produit.material]
  }
  if (produit.size) {
    aspects['Size'] = [produit.size]
  }
  
  aspects['Style'] = ['Vintage']
  aspects['Country/Region of Manufacture'] = ['France']
  
  return aspects
}

/**
 * Crée ou met à jour un inventoryItem sur eBay
 */
async function createOrUpdateInventoryItem(produit: EbayProduct): Promise<void> {
  
  const inventoryItem = {
    availability: {
      shipToLocationAvailability: {
        quantity: 1,
      },
    },
    condition: 'USED_VERY_GOOD',
    product: {
      title: formatEbayTitle(produit.title, produit.brand),
      description: formatEbayDescription(produit.description, produit),
      imageUrls: produit.imageUrls.slice(0, 12),
      aspects: buildProductAspects(produit),
    },
  }
  
  await ebayApiCall(`/sell/inventory/v1/inventory_item/${produit.sku}`, {
    method: 'PUT',
    body: inventoryItem,
  })
  
  console.log(`✅ InventoryItem créé: ${produit.sku}`)
}

/**
 * Récupère l'offer existante pour un SKU
 */
async function getExistingOffer(sku: string): Promise<{ offerId: string; offer: any } | null> {
  try {
    const response = await ebayApiCall<{ offers: Array<any> }>(
      `/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`,
      { method: 'GET' }
    )

    if (response.offers && response.offers.length > 0) {
      const offer = response.offers[0]
      return { offerId: offer.offerId, offer }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Met à jour une offer existante avec les nouvelles valeurs
 */
async function updateOffer(offerId: string, produit: EbayProduct, categoryId: string): Promise<void> {
  const priceUSD = produit.priceUSD || calculateEbayPrice(produit.priceEUR)

  const offerUpdate = {
    availableQuantity: 1,
    categoryId: categoryId,
    merchantLocationKey: EBAY_MERCHANT_LOCATION_KEY,
    listingDescription: formatEbayDescription(produit.description, produit),
    listingPolicies: {
      fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID,
      paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID,
      returnPolicyId: process.env.EBAY_RETURN_POLICY_ID,
    },
    pricingSummary: {
      price: {
        value: priceUSD.toString(),
        currency: EBAY_CURRENCY,
      },
    },
  }

  await ebayApiCall(`/sell/inventory/v1/offer/${offerId}`, {
    method: 'PUT',
    body: offerUpdate,
  })

  console.log(`✅ Offer mise à jour: ${offerId}`)
}

/**
 * Crée une offer pour un inventoryItem
 */
async function createOffer(produit: EbayProduct, categoryId: string): Promise<string> {
  const priceUSD = produit.priceUSD || calculateEbayPrice(produit.priceEUR)

  const offer = {
    sku: produit.sku,
    marketplaceId: EBAY_MARKETPLACE_ID,
    format: 'FIXED_PRICE',
    listingDescription: formatEbayDescription(produit.description, produit),
    availableQuantity: 1,
    categoryId: categoryId,
    merchantLocationKey: EBAY_MERCHANT_LOCATION_KEY,
    listingPolicies: {
      fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID,
      paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID,
      returnPolicyId: process.env.EBAY_RETURN_POLICY_ID,
    },
    pricingSummary: {
      price: {
        value: priceUSD.toString(),
        currency: EBAY_CURRENCY,
      },
    },
  }

  try {
    const response = await ebayApiCall<{ offerId: string }>('/sell/inventory/v1/offer', {
      method: 'POST',
      body: offer,
    })

    console.log(`✅ Offer créée: ${response.offerId}`)
    return response.offerId
  } catch (error: any) {
    // Si l'offer existe déjà, récupérer et mettre à jour avec merchantLocationKey
    if (error?.message?.includes('already exists') || error?.message?.includes('Offer entity already exists')) {
      console.log(`ℹ️ Offer existe déjà pour SKU: ${produit.sku}, mise à jour...`)
      const existing = await getExistingOffer(produit.sku)
      if (existing) {
        await updateOffer(existing.offerId, produit, categoryId)
        return existing.offerId
      }
    }
    throw error
  }
}

/**
 * Récupère le listingId d'une offer existante
 */
async function getOfferListingId(offerId: string): Promise<string | null> {
  try {
    const response = await ebayApiCall<{ listingId?: string; status: string }>(
      `/sell/inventory/v1/offer/${offerId}`,
      { method: 'GET' }
    )

    return response.listingId || null
  } catch {
    return null
  }
}

/**
 * Publie une offer pour créer le listing
 */
async function publishOffer(offerId: string): Promise<string> {
  try {
    const response = await ebayApiCall<{ listingId: string }>(`/sell/inventory/v1/offer/${offerId}/publish`, {
      method: 'POST',
    })

    console.log(`✅ Listing publié: ${response.listingId}`)
    return response.listingId
  } catch (error: any) {
    // Si l'offer est déjà publiée, récupérer le listingId existant
    if (error?.message?.includes('already published') || error?.message?.includes('PUBLISHED')) {
      console.log(`ℹ️ Offer déjà publiée: ${offerId}, récupération du listingId...`)
      const existingListingId = await getOfferListingId(offerId)
      if (existingListingId) {
        console.log(`✅ ListingId existant récupéré: ${existingListingId}`)
        return existingListingId
      }
    }
    throw error
  }
}

/**
 * Publie un produit sur eBay (fonction principale)
 */
export async function publishToEbay(produit: EbayProduct): Promise<EbayListingResponse> {
  try {
    if (!isEbayConfigured()) {
      return { success: false, error: 'eBay non configuré' }
    }

    if (!produit.sku || !produit.title || !produit.priceEUR) {
      return { success: false, error: 'Données incomplètes (sku, title, priceEUR requis)' }
    }

    if (!produit.imageUrls || produit.imageUrls.length === 0) {
      return { success: false, error: 'Au moins une image requise' }
    }

    // Créer la location marchande si pas encore fait
    if (!locationInitialized) {
      await ensureMerchantLocation()
    }

    console.log(`📤 Publication eBay: ${produit.title}`)

    // Trouver la catégorie eBay
    const category = findEbayCategory(produit.categoryId)

    // 1. Créer l'inventoryItem
    await createOrUpdateInventoryItem(produit)

    // 2. Créer l'offer
    const offerId = await createOffer(produit, category.ebayCategoryId)

    // 3. Publier
    const listingId = await publishOffer(offerId)

    return { success: true, listingId, offerId }

  } catch (error: any) {
    console.error('❌ Erreur publication eBay:', error?.message)
    return { success: false, error: error?.message }
  }
}

/**
 * Met à jour un listing existant
 */
export async function updateEbayListing(
  produit: EbayProduct,
  existingOfferId: string
): Promise<EbayListingResponse> {
  try {
    if (!isEbayConfigured()) {
      return { success: false, error: 'eBay non configuré' }
    }
    
    await createOrUpdateInventoryItem(produit)
    
    return { success: true, offerId: existingOfferId }
    
  } catch (error: any) {
    return { success: false, error: error?.message }
  }
}

/**
 * Prépare un produit Firebase pour publication eBay
 */

export function prepareProductForEbay(firebaseProduct: any): EbayProduct {
  const localCategory = typeof firebaseProduct.categorie === 'object' 
    ? firebaseProduct.categorie?.label 
    : firebaseProduct.categorie
  
  // Collecter toutes les images
  let imageUrls: string[] = []
  if (firebaseProduct.imageUrls?.length > 0) {
    imageUrls = firebaseProduct.imageUrls
  } else if (firebaseProduct.photos?.face) {
    imageUrls = [
      firebaseProduct.photos.face,
      firebaseProduct.photos.faceOnModel,
      firebaseProduct.photos.dos,
      ...(firebaseProduct.photos.details || [])
    ].filter(Boolean)
  } else if (firebaseProduct.imageUrl) {
    imageUrls = [firebaseProduct.imageUrl]
  }
  
  return {
    firebaseId: firebaseProduct.id,
    sku: firebaseProduct.sku || firebaseProduct.id,
    title: firebaseProduct.nom || 'Vintage Item',
    description: firebaseProduct.description || '',
    condition: 'USED_VERY_GOOD',
    priceEUR: firebaseProduct.prix || 0,
    categoryId: localCategory || '',
    imageUrls,
    brand: firebaseProduct.marque,
    material: firebaseProduct.material,
    color: firebaseProduct.color,
    size: firebaseProduct.taille,
  }
}

/**
 * Crée la location marchande sur eBay (setup initial, à exécuter une fois)
 * Nécessaire pour que les offers aient un pays d'expédition
 */
export async function createEbayMerchantLocation(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isEbayConfigured()) {
      return { success: false, error: 'eBay non configuré' }
    }

    const locationKey = EBAY_MERCHANT_LOCATION_KEY

    const locationData = {
      location: {
        address: {
          city: 'Paris',
          postalCode: '75004',
          country: 'FR',
        },
      },
      name: 'Nouvelle Rive - Le Marais',
      merchantLocationStatus: 'ENABLED',
      locationTypes: ['STORE'],
    }

    await ebayApiCall(`/sell/inventory/v1/location/${locationKey}`, {
      method: 'POST',
      body: locationData,
    })

    console.log(`✅ Location eBay créée: ${locationKey}`)
    return { success: true }

  } catch (error: any) {
    // Si la location existe déjà, ce n'est pas une erreur
    if (error?.message?.includes('already exists')) {
      console.log(`ℹ️ Location eBay existe déjà: ${EBAY_MERCHANT_LOCATION_KEY}`)
      return { success: true }
    }
    console.error('❌ Erreur création location eBay:', error?.message)
    return { success: false, error: error?.message }
  }
}