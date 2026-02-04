// lib/modeles.ts

// =====================
// MODÈLES PAR CATÉGORIE
// =====================

export const MODELES = {
  pantalon: [
    'Droit',
    'Cigarette',
    'Carotte',
    'Slim',
    'Skinny',
    'Bootcut',
    'Flare / Patte d\'eph',
    'Large / Palazzo',
    'Cargo',
    'Capri',
  ],
  jupe: [
    'Mini',
    'Genou',
    'Midi',
    'Longue',
    'Crayon',
    'Moulante',
    'Plissée',
    'Évasée',
    'Portefeuille',
  ],
  robe: [
    'Mini',
    'Genou',
    'Midi',
    'Longue',
    'Chemise',
    'Portefeuille',
    'Fourreau',
    'Moulante',
    'Ample',
  ],
  veste: [
    'Blazer',
    'Perfecto',
    'Bomber',
    'Teddy',
    'Blouson',
    'Veste en jean',
    'Saharienne',
    'Trench',
    'Parka',
    'Doudoune',
    'Manteau',
    'Caban',
    'Cape',
    'Poncho',
  ],
}

// =====================
// CATÉGORIES QUI ONT DES MODÈLES
// =====================

const CATEGORIES_PANTALON = ['pantalon', 'jean', 'jogging', 'legging', 'short']
const CATEGORIES_JUPE = ['jupe']
const CATEGORIES_ROBE = ['robe', 'combinaison']
const CATEGORIES_VESTE = ['veste', 'manteau', 'blouson', 'blazer', 'parka', 'doudoune', 'trench', 'cape']

// =====================
// HELPERS
// =====================

import { extractCategorie } from './tailles'

export type TypeModele = 'pantalon' | 'jupe' | 'robe' | 'veste' | null

/**
 * Détermine le type de modèle en fonction de la catégorie
 */
export function detectTypeModele(categorieComplete: string): TypeModele {
  const categorie = extractCategorie(categorieComplete).toLowerCase()
  
  if (CATEGORIES_PANTALON.some(c => categorie.includes(c))) {
    return 'pantalon'
  }
  
  if (CATEGORIES_JUPE.some(c => categorie.includes(c))) {
    return 'jupe'
  }
  
  if (CATEGORIES_ROBE.some(c => categorie.includes(c))) {
    return 'robe'
  }
  
  if (CATEGORIES_VESTE.some(c => categorie.includes(c))) {
    return 'veste'
  }
  
  return null
}

/**
 * Retourne les modèles disponibles pour une catégorie
 */
export function getModelesForCategorie(categorieComplete: string): string[] {
  const type = detectTypeModele(categorieComplete)
  if (!type) return []
  return MODELES[type]
}

/**
 * Tous les modèles possibles (pour le template Excel)
 */
export const ALL_MODELES = [
  ...new Set([
    ...MODELES.pantalon,
    ...MODELES.jupe,
    ...MODELES.robe,
    ...MODELES.veste,
  ])
]