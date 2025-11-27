// lib/ebay/types.ts

/**
 * Types pour l'intégration eBay
 */

// Condition des produits eBay
export type EbayCondition = 
  | 'NEW'
  | 'LIKE_NEW'
  | 'NEW_OTHER'
  | 'NEW_WITH_DEFECTS'
  | 'MANUFACTURER_REFURBISHED'
  | 'CERTIFIED_REFURBISHED'
  | 'EXCELLENT_REFURBISHED'
  | 'VERY_GOOD_REFURBISHED'
  | 'GOOD_REFURBISHED'
  | 'SELLER_REFURBISHED'
  | 'USED_EXCELLENT'
  | 'USED_VERY_GOOD'
  | 'USED_GOOD'
  | 'USED_ACCEPTABLE'
  | 'FOR_PARTS_OR_NOT_WORKING'

// Produit à publier sur eBay
export interface EbayProduct {
  // Identifiants
  firebaseId: string
  sku: string
  
  // Infos produit
  title: string
  description: string
  condition: EbayCondition
  conditionDescription?: string
  
  // Prix (en EUR, sera converti en USD)
  priceEUR: number
  priceUSD?: number
  
  // Catégorie eBay
  categoryId: string
  
  // Images (URLs Cloudinary)
  imageUrls: string[]
  
  // Attributs optionnels
  brand?: string
  material?: string
  color?: string
  size?: string
  
  // Shipping
  weightGrams?: number
  packageType?: 'ENVELOPE' | 'SMALL_BOX' | 'MEDIUM_BOX' | 'LARGE_BOX'
}

// Réponse après publication
export interface EbayListingResponse {
  success: boolean
  listingId?: string
  offerId?: string
  error?: string
  warnings?: string[]
}

// Événement webhook eBay (vente)
export interface EbayOrderEvent {
  orderId: string
  lineItems: Array<{
    lineItemId: string
    sku: string
    title: string
    quantity: number
    priceUSD: number
  }>
  buyer: {
    username: string
    email?: string
  }
  shippingAddress?: {
    name: string
    street1: string
    street2?: string
    city: string
    stateOrProvince: string
    postalCode: string
    country: string
  }
  orderTotal: number
  createdAt: string
}

// Config pour le client eBay
export interface EbayConfig {
  clientId: string
  clientSecret: string
  devId: string
  environment: 'sandbox' | 'production'
  ruName?: string
}

// Token d'accès eBay
export interface EbayToken {
  accessToken: string
  expiresAt: number
  tokenType: string
  refreshToken?: string
}

// Mapping catégorie locale → eBay
export interface CategoryMapping {
  localKeyword: string
  ebayCategoryId: string
  ebayCategoryName: string
  suggestedAspects?: Record<string, string[]>
}