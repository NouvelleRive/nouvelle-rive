// lib/ebay/index.ts

/**
 * Point d'entrée du module eBay
 * 
 * Usage:
 * import { publishToEbay, removeFromEbay } from '@/lib/ebay'
 */

// Types
export * from './types'

// Client API
export { 
  getEbayConfig,
  getAccessToken,
  ebayApiCall,
  isEbayConfigured,
  convertEURtoUSD,
  calculateEbayPrice,
} from './clients'

// Catégories
export {
  findEbayCategory,
  extractKeywordFromCategory,
  estimateShippingByCategory,
  getAllCategoryMappings,
} from './categories'

// Publication
export {
  publishToEbay,
  updateEbayListing,
  prepareProductForEbay,
  wearTypeToGender,
} from './publish'

// Types de publication
export type { EbayGender } from './publish'

// Retrait
export {
  withdrawOffer,
  deleteInventoryItem,
  removeFromEbay,
  updateEbayQuantity,
  isListedOnEbay,
} from './remove'