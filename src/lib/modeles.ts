// lib/modeles.ts

import { extractCategorie } from './tailles'

// =====================
// MODÈLES PAR CATÉGORIE
// =====================

export const MODELES: Record<string, string[]> = {
  haut: [
    'Blouse',
    'Body',
    'Bustier',
    'Chemise',
    'Corset',
    'Crop top',
    'Débardeur',
    'Polo',
    'T-shirt',
    'Top',
  ],
  pull: [
    'Cardigan',
    'Col roulé',
    'Col V',
    'Gilet',
    'Hoodie',
    'Pull col rond',
    'Sweat',
  ],
  veste: [
    'Blazer',
    'Blouson',
    'Bomber',
    'Caban',
    'Cape',
    'Doudoune',
    'Manteau',
    'Parka',
    'Perfecto',
    'Poncho',
    'Saharienne',
    'Teddy',
    'Trench',
    'Veste en jean',
  ],
  robe: [
    'Ample',
    'Bustier',
    'Chemise',
    'Fourreau',
    'Longue',
    'Midi',
    'Mini',
    'Moulante',
    'Portefeuille',
  ],
  pantalon: [
    'Bootcut',
    'Capri',
    'Cargo',
    'Carotte',
    'Cigarette',
    'Droit',
    'Flare / Patte d\'eph',
    'Large / Palazzo',
    'Skinny',
    'Slim',
  ],
  jupe: [
    'Crayon',
    'Évasée',
    'Longue',
    'Midi',
    'Mini',
    'Moulante',
    'Plissée',
    'Portefeuille',
  ],
  ensemble: [
    'Coord set',
    'Jogging',
    'Tailleur',
  ],
  sac: [
    'À main',
    'Baguette',
    'Banane',
    'Bandoulière',
    'Besace',
    'Bowling',
    'Cabas',
    'Clutch',
    'Minaudière',
    'Pochette',
    'Seau',
  ],
  chaussures: [
    'Ballerines',
    'Baskets',
    'Bottes',
    'Bottines',
    'Cuissardes',
    'Derbies',
    'Escarpins',
    'Mocassins',
    'Mules',
    'Sabots',
    'Sandales',
  ],
  collier: [
    'Chaîne',
    'Choker',
    'Multi-rangs',
    'Pendentif',
    'Plastron',
    'Ras-de-cou',
    'Sautoir',
  ],
  boucles: [
    'Chandeliers',
    'Clips',
    'Créoles',
    'Dormeuses',
    'Pendantes',
    'Puces',
  ],
  bracelet: [
    'Chaîne',
    'Jonc',
    'Manchette',
    'Rigide',
  ],
  bague: [
    'Alliance',
    'Chevalière',
    'Solitaire',
  ],
  ceinture: [
    'Chaîne',
    'Fine',
    'Large',
  ],
  chapeau: [
    'Béret',
    'Bob',
    'Capeline',
    'Casquette',
    'Fedora',
  ],
}

// =====================
// MAPPING CATÉGORIES → TYPE MODÈLE
// =====================

const CATEGORY_MAP: Record<string, string> = {
  'haut': 'haut',
  'chemise': 'haut',
  'top': 'haut',
  'blouse': 'haut',
  'pull': 'pull',
  'gilet': 'pull',
  'pull / gilet': 'pull',
  'veste': 'veste',
  'manteau': 'veste',
  'veste / manteau': 'veste',
  'blouson': 'veste',
  'blazer': 'veste',
  'parka': 'veste',
  'doudoune': 'veste',
  'trench': 'veste',
  'cape': 'veste',
  'robe': 'robe',
  'combinaison': 'robe',
  'pantalon': 'pantalon',
  'jean': 'pantalon',
  'jogging': 'pantalon',
  'short': 'pantalon',
  'jupe': 'jupe',
  'jupe / short': 'jupe',
  'ensemble': 'ensemble',
  'sac': 'sac',
  'chaussures': 'chaussures',
  'collier': 'collier',
  "boucles d'oreilles": 'boucles',
  'bracelet': 'bracelet',
  'bague': 'bague',
  'ceinture': 'ceinture',
  'chapeau': 'chapeau',
  'casquette': 'chapeau',
}

// =====================
// HELPERS
// =====================

export type TypeModele = string | null

export function detectTypeModele(categorieComplete: string): TypeModele {
  const categorie = extractCategorie(categorieComplete).toLowerCase()
  for (const [key, type] of Object.entries(CATEGORY_MAP)) {
    if (categorie.includes(key)) return type
  }
  return null
}

export function getModelesForCategorie(categorieComplete: string): string[] {
  const type = detectTypeModele(categorieComplete)
  if (!type || !MODELES[type]) return []
  return MODELES[type]
}

export const ALL_MODELES = [...new Set(Object.values(MODELES).flat())].sort((a, b) => a.localeCompare(b, 'fr'))

// =====================
// AUTO-DÉTECTION MODÈLE DEPUIS LE TITRE
// =====================

const ALL_MODELES_FLAT = Object.entries(MODELES).flatMap(([type, models]) =>
  models.map(m => ({ model: m, type }))
).sort((a, b) => b.model.length - a.model.length)

export function detectModele(titre: string): string | null {
  const t = titre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const { model } of ALL_MODELES_FLAT) {
    const m = model.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const escaped = m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'i')
    if (regex.test(t)) return model
  }
  return null
}