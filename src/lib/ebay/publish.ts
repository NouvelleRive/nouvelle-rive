// lib/ebay/publish.ts

/**
 * Fonctions pour publier des produits sur eBay
 */

import { ebayApiCall, calculateEbayPrice, isEbayConfigured } from './clients'
import { EbayProduct, EbayListingResponse } from './types'

const EBAY_MARKETPLACE_ID = 'EBAY_US'
const EBAY_CURRENCY = 'USD'
const EBAY_MERCHANT_LOCATION_KEY = process.env.EBAY_MERCHANT_LOCATION_KEY || 'PARIS_STORE'

// ============================================================================
// MAPPING CATÉGORIES FIREBASE → EBAY US PAR GENRE
// ============================================================================

export type EbayGender = 'women' | 'men'

// Catégories eBay FEMME
const EBAY_CATEGORY_WOMEN: Record<string, { categoryId: string; type: string }> = {
  // Sacs
  'sac': { categoryId: '169291', type: 'bags' },
  'pochette': { categoryId: '169291', type: 'bags' },
  'sac à main': { categoryId: '169291', type: 'bags' },
  'besace': { categoryId: '169291', type: 'bags' },
  // Manteaux / Vestes
  'manteau': { categoryId: '63862', type: 'coats' },
  'veste': { categoryId: '63862', type: 'coats' },
  'blazer': { categoryId: '63862', type: 'coats' },
  'blouson': { categoryId: '63862', type: 'coats' },
  'parka': { categoryId: '63862', type: 'coats' },
  'trench': { categoryId: '63862', type: 'coats' },
  // Robes
  'robe': { categoryId: '63861', type: 'dresses' },
  // Hauts
  'haut': { categoryId: '53159', type: 'tops' },
  'chemise': { categoryId: '53159', type: 'tops' },
  'chemisier': { categoryId: '53159', type: 'tops' },
  'blouse': { categoryId: '53159', type: 'tops' },
  't-shirt': { categoryId: '53159', type: 'tops' },
  'top': { categoryId: '53159', type: 'tops' },
  'débardeur': { categoryId: '53159', type: 'tops' },
  // Pantalons
  'pantalon': { categoryId: '63863', type: 'pants' },
  'jean': { categoryId: '63863', type: 'pants' },
  'jeans': { categoryId: '63863', type: 'pants' },
  'short': { categoryId: '63863', type: 'pants' },
  // Jupes
  'jupe': { categoryId: '63864', type: 'skirts' },
  // Pulls
  'pull': { categoryId: '63866', type: 'sweaters' },
  'gilet': { categoryId: '63866', type: 'sweaters' },
  'cardigan': { categoryId: '63866', type: 'sweaters' },
  'maille': { categoryId: '63866', type: 'sweaters' },
  'tricot': { categoryId: '63866', type: 'sweaters' },
  // Chaussures
  'chaussures': { categoryId: '55793', type: 'shoes' },
  'escarpins': { categoryId: '55793', type: 'shoes' },
  'bottes': { categoryId: '55793', type: 'shoes' },
  'bottines': { categoryId: '55793', type: 'shoes' },
  'sandales': { categoryId: '55793', type: 'shoes' },
  'mocassins': { categoryId: '55793', type: 'shoes' },
  // Accessoires
  'accessoire': { categoryId: '4251', type: 'accessories' },
  'accessoires': { categoryId: '4251', type: 'accessories' },
  'ceinture': { categoryId: '4251', type: 'accessories' },
  'écharpe': { categoryId: '4251', type: 'accessories' },
  'foulard': { categoryId: '4251', type: 'accessories' },
  'chapeau': { categoryId: '4251', type: 'accessories' },
  'bijoux': { categoryId: '4251', type: 'accessories' },
}

// Catégories eBay HOMME
const EBAY_CATEGORY_MEN: Record<string, { categoryId: string; type: string }> = {
  // Sacs (pas de catégorie spécifique homme, utiliser unisex bags)
  'sac': { categoryId: '169285', type: 'bags' },
  'pochette': { categoryId: '169285', type: 'bags' },
  'besace': { categoryId: '169285', type: 'bags' },
  // Manteaux / Vestes
  'manteau': { categoryId: '57988', type: 'coats' },
  'veste': { categoryId: '57988', type: 'coats' },
  'blazer': { categoryId: '57988', type: 'coats' },
  'blouson': { categoryId: '57988', type: 'coats' },
  'parka': { categoryId: '57988', type: 'coats' },
  'trench': { categoryId: '57988', type: 'coats' },
  // Hauts
  'haut': { categoryId: '185100', type: 'tops' },
  'chemise': { categoryId: '185100', type: 'tops' },
  't-shirt': { categoryId: '185100', type: 'tops' },
  'polo': { categoryId: '185100', type: 'tops' },
  'débardeur': { categoryId: '185100', type: 'tops' },
  // Pantalons
  'pantalon': { categoryId: '57989', type: 'pants' },
  'jean': { categoryId: '57989', type: 'pants' },
  'jeans': { categoryId: '57989', type: 'pants' },
  'short': { categoryId: '57989', type: 'pants' },
  // Pulls
  'pull': { categoryId: '11484', type: 'sweaters' },
  'gilet': { categoryId: '11484', type: 'sweaters' },
  'cardigan': { categoryId: '11484', type: 'sweaters' },
  'maille': { categoryId: '11484', type: 'sweaters' },
  'tricot': { categoryId: '11484', type: 'sweaters' },
  // Chaussures
  'chaussures': { categoryId: '93427', type: 'shoes' },
  'bottes': { categoryId: '93427', type: 'shoes' },
  'bottines': { categoryId: '93427', type: 'shoes' },
  'mocassins': { categoryId: '93427', type: 'shoes' },
  'sneakers': { categoryId: '93427', type: 'shoes' },
  // Accessoires
  'accessoire': { categoryId: '4250', type: 'accessories' },
  'accessoires': { categoryId: '4250', type: 'accessories' },
  'ceinture': { categoryId: '4250', type: 'accessories' },
  'écharpe': { categoryId: '4250', type: 'accessories' },
  'foulard': { categoryId: '4250', type: 'accessories' },
  'chapeau': { categoryId: '4250', type: 'accessories' },
}

const DEFAULT_EBAY_CATEGORY_WOMEN = { categoryId: '15724', type: 'default' } // Women's Clothing
const DEFAULT_EBAY_CATEGORY_MEN = { categoryId: '1059', type: 'default' } // Men's Clothing

/**
 * Trouve la catégorie eBay à partir de la catégorie/sous-catégorie Firebase et du genre
 */
function findEbayCategoryFromFirebase(
  categoryId?: string,
  sousCat?: string,
  gender: EbayGender = 'women'
): { categoryId: string; type: string } {
  const categoryMap = gender === 'men' ? EBAY_CATEGORY_MEN : EBAY_CATEGORY_WOMEN
  const defaultCategory = gender === 'men' ? DEFAULT_EBAY_CATEGORY_MEN : DEFAULT_EBAY_CATEGORY_WOMEN

  // Chercher d'abord dans sousCat, puis dans categoryId
  const searchTerms = [sousCat, categoryId].filter(Boolean)

  for (const term of searchTerms) {
    if (!term) continue
    const normalizedTerm = term.toLowerCase().trim()

    // Chercher une correspondance exacte
    if (categoryMap[normalizedTerm]) {
      return categoryMap[normalizedTerm]
    }

    // Chercher une correspondance partielle
    for (const [key, value] of Object.entries(categoryMap)) {
      if (normalizedTerm.includes(key) || key.includes(normalizedTerm)) {
        return value
      }
    }
  }

  return defaultCategory
}

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
 * Construit les aspects (attributs) du produit selon la catégorie eBay et le genre
 */
function buildProductAspects(produit: EbayProduct, categoryType: string, gender: EbayGender): Record<string, string[]> {
  const aspects: Record<string, string[]> = {}
  const department = gender === 'men' ? 'Men' : 'Women'

  // Aspects communs à toutes les catégories
  aspects['Brand'] = [produit.brand || 'Unbranded']
  aspects['Color'] = [produit.color || 'Multicolor']
  aspects['Vintage'] = ['Yes']
  aspects['Country/Region of Manufacture'] = ['France']

  switch (categoryType) {
    case 'bags':
      // Sacs et pochettes
      aspects['Department'] = [department]
      aspects['Style'] = ['Shoulder Bag']
      aspects['Size'] = ['Medium']
      aspects['Exterior Material'] = [produit.material || 'Leather']
      aspects['Closure'] = ['Zip']
      aspects['Handmade'] = ['No']
      break

    case 'coats':
      // Manteaux, vestes, blazers (57988)
      aspects['Department'] = [department]
      aspects['Type'] = ['Jacket']
      aspects['Style'] = ['Vintage']
      aspects['Size'] = [produit.size || 'M']
      aspects['Size Type'] = ['Regular']
      aspects['Pattern'] = ['Solid']
      aspects['Closure'] = ['Button']
      aspects['Outer Shell Material'] = [produit.material || 'Cotton Blend']
      aspects['Lining Material'] = ['Polyester']
      aspects['Handmade'] = ['No']
      break

    case 'dresses':
      // Robes (63861)
      aspects['Department'] = [department]
      aspects['Type'] = ['Shift Dress']
      aspects['Style'] = ['Vintage']
      aspects['Size'] = [produit.size || 'M']
      aspects['Size Type'] = ['Regular']
      aspects['Sleeve Length'] = ['Long Sleeve']
      aspects['Pattern'] = ['Solid']
      aspects['Neckline'] = ['Round Neck']
      aspects['Material'] = [produit.material || 'Cotton']
      aspects['Handmade'] = ['No']
      break

    case 'tops':
      // Hauts, chemises, t-shirts (53159)
      aspects['Department'] = [department]
      aspects['Type'] = ['Blouse']
      aspects['Style'] = ['Vintage']
      aspects['Size'] = [produit.size || 'M']
      aspects['Size Type'] = ['Regular']
      aspects['Sleeve Length'] = ['Long Sleeve']
      aspects['Pattern'] = ['Solid']
      aspects['Neckline'] = ['Round Neck']
      aspects['Material'] = [produit.material || 'Cotton']
      aspects['Handmade'] = ['No']
      break

    case 'pants':
      // Pantalons, jeans (63863)
      aspects['Department'] = [department]
      aspects['Type'] = ['Casual Pants']
      aspects['Style'] = ['Vintage']
      aspects['Size'] = [produit.size || 'M']
      aspects['Size Type'] = ['Regular']
      aspects['Rise'] = ['Mid']
      aspects['Inseam'] = ['Regular']
      aspects['Pattern'] = ['Solid']
      aspects['Material'] = [produit.material || 'Cotton']
      aspects['Closure'] = ['Zip']
      aspects['Handmade'] = ['No']
      break

    case 'skirts':
      // Jupes (63864)
      aspects['Department'] = [department]
      aspects['Type'] = ['A-Line Skirt']
      aspects['Style'] = ['Vintage']
      aspects['Size'] = [produit.size || 'M']
      aspects['Size Type'] = ['Regular']
      aspects['Skirt Length'] = ['Knee-Length']
      aspects['Pattern'] = ['Solid']
      aspects['Material'] = [produit.material || 'Cotton']
      aspects['Handmade'] = ['No']
      break

    case 'sweaters':
      // Pulls, gilets (63866)
      aspects['Department'] = [department]
      aspects['Type'] = ['Pullover']
      aspects['Style'] = ['Vintage']
      aspects['Size'] = [produit.size || 'M']
      aspects['Size Type'] = ['Regular']
      aspects['Sleeve Length'] = ['Long Sleeve']
      aspects['Pattern'] = ['Solid']
      aspects['Neckline'] = ['Round Neck']
      aspects['Material'] = [produit.material || 'Wool Blend']
      aspects['Handmade'] = ['No']
      break

    case 'shoes':
      // Chaussures (55793)
      aspects['Department'] = [department]
      aspects['Type'] = ['Heels']
      aspects['Style'] = ['Vintage']
      aspects['US Shoe Size'] = [produit.size || '8']
      aspects['Upper Material'] = [produit.material || 'Leather']
      aspects['Heel Height'] = ['Mid Heel (1.5-3 in)']
      aspects['Occasion'] = ['Casual']
      aspects['Handmade'] = ['No']
      break

    case 'accessories':
      // Accessoires (4251)
      aspects['Department'] = [department]
      aspects['Type'] = ['Scarf']
      aspects['Style'] = ['Vintage']
      aspects['Material'] = [produit.material || 'Silk']
      aspects['Handmade'] = ['No']
      break

    default:
      // Catégorie par défaut (11450)
      aspects['Department'] = [department]
      aspects['Style'] = ['Vintage']
      aspects['Size'] = [produit.size || 'M']
      aspects['Material'] = [produit.material || 'Cotton']
      aspects['Handmade'] = ['No']
      break
  }

  return aspects
}

/**
 * Crée ou met à jour un inventoryItem sur eBay
 */
async function createOrUpdateInventoryItem(produit: EbayProduct, categoryType: string, gender: EbayGender): Promise<void> {

  const inventoryItem = {
    availability: {
      shipToLocationAvailability: {
        quantity: 1,
      },
    },
    condition: 'USED_EXCELLENT',
    product: {
      title: formatEbayTitle(produit.title, produit.brand),
      description: formatEbayDescription(produit.description, produit),
      imageUrls: produit.imageUrls.slice(0, 12),
      aspects: buildProductAspects(produit, categoryType, gender),
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
 * Si le genre n'est pas spécifié et ne peut pas être déterminé, retourne GENDER_REQUIRED
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

    // Vérifier que le genre est spécifié
    if (!produit.gender) {
      return { success: false, error: 'GENDER_REQUIRED' }
    }

    const gender: EbayGender = produit.gender

    // Créer la location marchande si pas encore fait
    if (!locationInitialized) {
      await ensureMerchantLocation()
    }

    console.log(`📤 Publication eBay: ${produit.title} (${gender})`)

    // Trouver la catégorie eBay à partir de la catégorie Firebase et du genre
    const ebayCategory = findEbayCategoryFromFirebase(produit.categoryId, produit.sousCat, gender)
    console.log(`📂 Catégorie eBay: ${ebayCategory.categoryId} (${ebayCategory.type}) - ${gender}`)

    // 1. Créer l'inventoryItem avec les aspects adaptés à la catégorie et au genre
    await createOrUpdateInventoryItem(produit, ebayCategory.type, gender)

    // 2. Créer l'offer
    const offerId = await createOffer(produit, ebayCategory.categoryId)

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

    if (!produit.gender) {
      return { success: false, error: 'GENDER_REQUIRED' }
    }

    const gender: EbayGender = produit.gender
    const ebayCategory = findEbayCategoryFromFirebase(produit.categoryId, produit.sousCat, gender)
    await createOrUpdateInventoryItem(produit, ebayCategory.type, gender)

    return { success: true, offerId: existingOfferId }

  } catch (error: any) {
    return { success: false, error: error?.message }
  }
}

/**
 * Convertit le wearType Firebase en genre eBay
 */
export function wearTypeToGender(wearType?: string): EbayGender | null {
  if (!wearType) return null
  if (wearType === 'womenswear') return 'women'
  if (wearType === 'menswear') return 'men'
  // 'unisex' retourne null pour déclencher GENDER_REQUIRED
  return null
}

/**
 * Prépare un produit Firebase pour publication eBay
 * @param firebaseProduct - Données du produit Firebase
 * @param gender - Genre optionnel (si non fourni, sera déterminé par la chineuse)
 */
export function prepareProductForEbay(firebaseProduct: any, gender?: EbayGender): EbayProduct {
  // Extraire la catégorie principale
  const localCategory = typeof firebaseProduct.categorie === 'object'
    ? firebaseProduct.categorie?.label
    : firebaseProduct.categorie

  // Extraire la sous-catégorie
  const sousCat = typeof firebaseProduct.sousCat === 'object'
    ? firebaseProduct.sousCat?.label
    : firebaseProduct.sousCat

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
    condition: 'USED_EXCELLENT',
    priceEUR: firebaseProduct.prix || 0,
    categoryId: localCategory || '',
    sousCat: sousCat || '',
    gender,
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