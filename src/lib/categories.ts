// lib/categories.ts

import { extractCategorie } from './tailles'

export const MACRO_CATEGORIES: Record<string, string> = {
  // Prêt-à-porter (tout vêtement)
  'haut': 'Prêt-à-porter',
  'chemise': 'Prêt-à-porter',
  'pull': 'Prêt-à-porter',
  'gilet': 'Prêt-à-porter',
  'pull / gilet': 'Prêt-à-porter',
  'veste': 'Prêt-à-porter',
  'manteau': 'Prêt-à-porter',
  'veste / manteau': 'Prêt-à-porter',
  'robe': 'Prêt-à-porter',
  'pantalon': 'Prêt-à-porter',
  'jupe': 'Prêt-à-porter',
  'jupe / short': 'Prêt-à-porter',
  'short': 'Prêt-à-porter',
  'ensemble': 'Prêt-à-porter',
  'combinaison': 'Prêt-à-porter',

  // Maroquinerie
  'sac': 'Maroquinerie',
  'portefeuille': 'Maroquinerie',
  'porte clef': 'Maroquinerie',

  // Chaussures
  'chaussures': 'Chaussures',

  // Accessoires (incluant lunettes et vases)
  'ceinture': 'Accessoires',
  'chapeau': 'Accessoires',
  'casquette': 'Accessoires',
  'écharpe': 'Accessoires',
  'foulard': 'Accessoires',
  'gants': 'Accessoires',
  'accessoires': 'Accessoires',
  'accesoires': 'Accessoires',
  'lunettes': 'Accessoires',
  'vase': 'Accessoires',
  'porte briquet': 'Accessoires',

  // Bijoux
  'bague': 'Bijoux',
  "boucles d'oreilles": 'Bijoux',
  'bracelet': 'Bijoux',
  'collier': 'Bijoux',
  'broche': 'Bijoux',
  'broches': 'Bijoux',
  'charms': 'Bijoux',
  'earcuff': 'Bijoux',
  'piercing': 'Bijoux',
  'bijoux': 'Bijoux',
  'bijou de cravates et foulards': 'Bijoux',
}

export const MACRO_ORDER = ['Prêt-à-porter', 'Maroquinerie', 'Bijoux', 'Chaussures', 'Accessoires']

export function getMacroCategorie(categorieComplete: string): string | null {
  const cat = extractCategorie(categorieComplete).toLowerCase()
  for (const [key, macro] of Object.entries(MACRO_CATEGORIES)) {
    if (cat.includes(key)) return macro
  }
  return null
}
