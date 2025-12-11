// lib/tailles.ts

// =====================
// CONSTANTES DE TAILLES
// =====================

export const TAILLES = {
  adulte: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  enfant: ['0-3M', '3-6M', '6-12M', '12-18M', '18-24M', '2A', '3A', '4A', '5A', '6A', '8A', '10A', '12A', '14A', '16A'],
  chaussures: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
  bagues: ['48', '49', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '62', '64', '66', 'Taille unique'],
  vases: ['S', 'M', 'L', 'XL'],
  tailleUnique: ['Taille unique'],
}

// =====================
// CATÉGORIES PAR TYPE
// =====================

// Catégories vêtements adulte
const CATEGORIES_ADULTE = [
  'haut',
  'chemise',
  'pull / gilet',
  'pull',
  'gilet',
  'veste / manteau',
  'veste',
  'manteau',
  'robe',
  'pantalon',
  'jupe / short',
  'jupe',
  'short',
  'ensemble',
  'combinaison',
]

// Catégories chaussures
const CATEGORIES_CHAUSSURES = [
  'chaussures',
]

// Catégories bagues
const CATEGORIES_BAGUES = [
  'bague',
]

// Catégories ceintures (mêmes tailles que adulte)
const CATEGORIES_CEINTURES = [
  'ceinture',
]

// Catégories vases
const CATEGORIES_VASES = [
  'vase',
]

// Catégories taille unique (bijoux + accessoires)
const CATEGORIES_TAILLE_UNIQUE = [
  'sac',
  'lunettes',
  'casquette',
  'chapeau',
  'porte clef',
  'accessoires',
  'accesoires', // typo dans Square
  'porte briquet',
  'boucles d\'oreilles',
  'bracelet',
  'collier',
  'broche',
  'charms',
  'earcuff',
  'piercing',
  'bijoux',
  'bijou de cravates et foulards',
]

// Trigrammes enfants
const TRIGRAMMES_ENFANT = ['BON']

// =====================
// HELPERS
// =====================

/**
 * Extrait le trigramme d'une catégorie complète
 * Ex: "BON - Haut" → "BON"
 */
export function extractTrigramme(categorieComplete: string): string {
  const cat = (categorieComplete || '').trim()
  if (cat.includes(' - ')) {
    return cat.split(' - ')[0].trim().toUpperCase()
  }
  return ''
}

/**
 * Extrait le nom de catégorie sans le trigramme
 * Ex: "BON - Haut" → "Haut"
 * Ex: "Haut" → "Haut"
 */
export function extractCategorie(categorieComplete: string): string {
  const cat = (categorieComplete || '').trim()
  if (cat.includes(' - ')) {
    return cat.split(' - ').slice(1).join(' - ').trim()
  }
  return cat
}

/**
 * Détermine le type de taille en fonction de la catégorie complète
 */
export type TypeTaille = 'adulte' | 'enfant' | 'chaussures' | 'bagues' | 'ceintures' | 'vases' | 'tailleUnique' | 'aucune'

export function detectTypeTaille(categorieComplete: string): TypeTaille {
  const trigramme = extractTrigramme(categorieComplete)
  const categorie = extractCategorie(categorieComplete).toLowerCase()
  
  // 1. Vérifier si c'est une marque enfant (BON)
  if (TRIGRAMMES_ENFANT.includes(trigramme)) {
    return 'enfant'
  }
  
  // 2. Vérifier le type par catégorie
  if (CATEGORIES_CHAUSSURES.some(c => categorie.includes(c))) {
    return 'chaussures'
  }
  
  if (CATEGORIES_BAGUES.some(c => categorie.includes(c))) {
    return 'bagues'
  }
  
  if (CATEGORIES_CEINTURES.some(c => categorie.includes(c))) {
    return 'ceintures'
  }
  
  if (CATEGORIES_VASES.some(c => categorie.includes(c))) {
    return 'vases'
  }
  
  if (CATEGORIES_TAILLE_UNIQUE.some(c => categorie.includes(c))) {
    return 'tailleUnique'
  }
  
  if (CATEGORIES_ADULTE.some(c => categorie.includes(c))) {
    return 'adulte'
  }
  
  // Par défaut, pas de taille (catégorie inconnue)
  return 'aucune'
}

/**
 * Retourne les tailles disponibles pour une catégorie
 * Ex: "BON - Haut" → ['0-3M', '3-6M', ...]
 * Ex: "AGE - Pantalon" → ['XXS', 'XS', 'S', ...]
 */
export function getTaillesPourCategorie(categorieComplete: string): string[] {
  const type = detectTypeTaille(categorieComplete)
  
  switch (type) {
    case 'enfant':
      return TAILLES.enfant
    case 'chaussures':
      return TAILLES.chaussures
    case 'bagues':
      return TAILLES.bagues
    case 'ceintures':
      return TAILLES.adulte // même tailles que adulte
    case 'vases':
      return TAILLES.vases
    case 'tailleUnique':
      return TAILLES.tailleUnique
    case 'adulte':
      return TAILLES.adulte
    case 'aucune':
    default:
      return []
  }
}

/**
 * Vérifie si une catégorie nécessite une taille
 */
export function categoriaNecessiteTaille(categorieComplete: string): boolean {
  const type = detectTypeTaille(categorieComplete)
  return type !== 'aucune'
}

/**
 * Toutes les tailles possibles (pour le template Excel)
 */
export const ALL_TAILLES = [
  ...new Set([
    ...TAILLES.adulte,
    ...TAILLES.enfant,
    ...TAILLES.chaussures,
    ...TAILLES.bagues,
    ...TAILLES.vases,
    ...TAILLES.tailleUnique,
  ])
]