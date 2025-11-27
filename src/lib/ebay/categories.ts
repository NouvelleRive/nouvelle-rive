// lib/ebay/categories.ts

/**
 * Mapping des catégories Nouvelle Rive vers eBay US
 * 
 * Format local : "TRIGRAMME - Type" (ex: "GIGI - Bague")
 * On extrait le mot-clé après le tiret
 */

import { CategoryMapping } from './types'

const CATEGORY_MAPPINGS: CategoryMapping[] = [
  // ========== BIJOUX ==========
  {
    localKeyword: 'bague',
    ebayCategoryId: '67681',
    ebayCategoryName: 'Rings',
  },
  {
    localKeyword: 'broche',
    ebayCategoryId: '50647',
    ebayCategoryName: 'Pins, Brooches',
  },
  {
    localKeyword: 'collier',
    ebayCategoryId: '67662',
    ebayCategoryName: 'Necklaces & Pendants',
  },
  {
    localKeyword: 'bracelet',
    ebayCategoryId: '67651',
    ebayCategoryName: 'Bracelets',
  },
  {
    localKeyword: 'boucle',
    ebayCategoryId: '67671',
    ebayCategoryName: 'Earrings',
  },

  // ========== VÊTEMENTS ==========
  {
    localKeyword: 'chemise',
    ebayCategoryId: '57991',
    ebayCategoryName: 'Casual Shirts',
  },
  {
    localKeyword: 'haut',
    ebayCategoryId: '53159',
    ebayCategoryName: 'Tops & Blouses',
  },
  {
    localKeyword: 'pantalon',
    ebayCategoryId: '57989',
    ebayCategoryName: 'Pants',
  },
  {
    localKeyword: 'veste',
    ebayCategoryId: '57988',
    ebayCategoryName: 'Coats, Jackets & Vests',
  },
  {
    localKeyword: 'manteau',
    ebayCategoryId: '57988',
    ebayCategoryName: 'Coats, Jackets & Vests',
  },
  {
    localKeyword: 'pull',
    ebayCategoryId: '11484',
    ebayCategoryName: 'Sweaters',
  },
  {
    localKeyword: 'robe',
    ebayCategoryId: '63861',
    ebayCategoryName: 'Dresses',
  },
  {
    localKeyword: 'jupe',
    ebayCategoryId: '63864',
    ebayCategoryName: 'Skirts',
  },

  // ========== ACCESSOIRES ==========
  {
    localKeyword: 'ceinture',
    ebayCategoryId: '2993',
    ebayCategoryName: 'Belts',
  },
  {
    localKeyword: 'chaussure',
    ebayCategoryId: '63889',
    ebayCategoryName: 'Heels',
  },
  {
    localKeyword: 'lunette',
    ebayCategoryId: '79720',
    ebayCategoryName: 'Sunglasses',
  },
  {
    localKeyword: 'sac',
    ebayCategoryId: '169291',
    ebayCategoryName: 'Handbags',
  },
  {
    localKeyword: 'carré',
    ebayCategoryId: '45238',
    ebayCategoryName: 'Scarves & Wraps',
  },
]

// Catégorie par défaut
const DEFAULT_CATEGORY: CategoryMapping = {
  localKeyword: 'default',
  ebayCategoryId: '11450',
  ebayCategoryName: 'Clothing, Shoes & Accessories',
}

/**
 * Extrait le mot-clé depuis "TRIGRAMME - Type"
 */
export function extractKeywordFromCategory(localCategory: string): string {
  if (!localCategory) return ''
  
  const parts = localCategory.split(' - ')
  if (parts.length >= 2) {
    return parts.slice(1).join(' ').toLowerCase().trim()
  }
  
  return localCategory.toLowerCase().trim()
}

/**
 * Trouve la catégorie eBay correspondante
 */
export function findEbayCategory(localCategory: string): CategoryMapping {
  const keyword = extractKeywordFromCategory(localCategory)
  
  if (!keyword) {
    return DEFAULT_CATEGORY
  }
  
  const match = CATEGORY_MAPPINGS.find(mapping => 
    keyword.includes(mapping.localKeyword) || 
    mapping.localKeyword.includes(keyword)
  )
  
  if (match) {
    console.log(`✅ Catégorie: "${localCategory}" → ${match.ebayCategoryName}`)
    return match
  }
  
  console.warn(`⚠️ Catégorie non trouvée: "${localCategory}" → défaut`)
  return DEFAULT_CATEGORY
}

/**
 * Estime le poids et emballage selon la catégorie
 */
export function estimateShippingByCategory(localCategory: string): {
  weightGrams: number
  packageType: 'ENVELOPE' | 'SMALL_BOX' | 'MEDIUM_BOX' | 'LARGE_BOX'
} {
  const keyword = extractKeywordFromCategory(localCategory)
  
  // Bijoux → Enveloppe
  if (['bague', 'broche', 'boucle', 'collier', 'bracelet'].some(k => keyword.includes(k))) {
    return { weightGrams: 50, packageType: 'ENVELOPE' }
  }
  
  // Petits accessoires → Petite boîte
  if (['ceinture', 'lunette', 'carré'].some(k => keyword.includes(k))) {
    return { weightGrams: 200, packageType: 'SMALL_BOX' }
  }
  
  // Sacs → Boîte moyenne
  if (keyword.includes('sac')) {
    return { weightGrams: 500, packageType: 'MEDIUM_BOX' }
  }
  
  // Chaussures → Boîte moyenne
  if (keyword.includes('chaussure')) {
    return { weightGrams: 800, packageType: 'MEDIUM_BOX' }
  }
  
  // Vêtements lourds → Boîte moyenne
  if (['manteau', 'veste'].some(k => keyword.includes(k))) {
    return { weightGrams: 1000, packageType: 'MEDIUM_BOX' }
  }
  
  // Vêtements légers → Petite boîte
  return { weightGrams: 400, packageType: 'SMALL_BOX' }
}

/**
 * Retourne tous les mappings
 */
export function getAllCategoryMappings(): CategoryMapping[] {
  return CATEGORY_MAPPINGS
}