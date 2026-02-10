// lib/categories.ts

import { extractCategorie } from './tailles'

export const MACRO_CATEGORIES: Record<string, string> = {
  // Prêt-à-porter
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

  // Sacs & Maroquinerie
  'sac': 'Sacs & Maroquinerie',
  'portefeuille': 'Sacs & Maroquinerie',
  'porte clef': 'Sacs & Maroquinerie',
  'porte briquet': 'Sacs & Maroquinerie',

  // Accessoires
  'ceinture': 'Accessoires',
  'chapeau': 'Accessoires',
  'casquette': 'Accessoires',
  'écharpe': 'Accessoires',
  'foulard': 'Accessoires',
  'gants': 'Accessoires',
  'accessoires': 'Accessoires',
  'accesoires': 'Accessoires',

  // Chaussures
  'chaussures': 'Chaussures',

  // Bijoux
  'bague': 'Bijoux',
  "boucles d'oreilles": 'Bijoux',
  'bracelet': 'Bijoux',
  'collier': 'Bijoux',
  'broche': 'Bijoux',
  'charms': 'Bijoux',
  'earcuff': 'Bijoux',
  'piercing': 'Bijoux',
  'bijoux': 'Bijoux',
  'bijou de cravates et foulards': 'Bijoux',

  // Lunettes
  'lunettes': 'Lunettes',
}

export const MACRO_ORDER = ['Prêt-à-porter', 'Sacs & Maroquinerie', 'Accessoires', 'Chaussures', 'Bijoux', 'Lunettes']

export function getMacroCategorie(categorieComplete: string): string | null {
  const cat = extractCategorie(categorieComplete).toLowerCase()
  for (const [key, macro] of Object.entries(MACRO_CATEGORIES)) {
    if (cat.includes(key)) return macro
  }
  return null
}