// lib/matieres.ts

// =====================
// CONSTANTES DE MATIÈRES
// =====================

export const MATIERES = {
  bijoux: ['Or', 'Argent', 'Plaqué or', 'Vermeil', 'Acier inoxydable', 'Laiton', 'Perles d\'eau douce', 'Perles de culture', 'Perles de synthèse', 'Pierres', 'Fantaisie'],
  maille: ['Laine', 'Cachemire', 'Angora', 'Mohair', 'Mérinos', 'Alpaga', 'Coton', 'Acrylique'],
  cuir: ['Cuir', 'Cuir verni', 'Daim', 'Nubuck', 'Cuir grainé', 'Simili cuir', 'Cuir tressé'],
  maro: ['Cuir', 'Cuir verni', 'Daim', 'Nubuck', 'Cuir grainé', 'Simili cuir', 'Toile', 'Tissu'],
  tissus: ['Soie', 'Coton', 'Lin', 'Laine', 'Polyester', 'Viscose', 'Satin', 'Velours', 'Tweed', 'Denim', 'Dentelle'],
  objets: ['Plastique recyclé', 'Acétate', 'Métal', 'Verre', 'Céramique', 'Résine'],
}

// =====================
// CATÉGORIES PAR TYPE DE MATIÈRE
// =====================

const CATEGORIES_BIJOUX = [
  'bague',
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

const CATEGORIES_MAILLE = [
  'pull',
  'gilet',
  'pull / gilet',
  'cardigan',
]

const CATEGORIES_CUIR = [
  'chaussures',
  'ceinture',
  'botte',
  'porte clef',
]

const CATEGORIES_MARO = [
  'sac',
]

const CATEGORIES_OBJETS = [
  'vase',
  'porte briquet',
]

// =====================
// HELPERS
// =====================

import { extractCategorie } from './tailles'

export type TypeMatiere = 'bijoux' | 'maille' | 'cuir' | 'maro' | 'tissus' | 'objets'

/**
 * Détermine le type de matière en fonction de la catégorie
 */
export function detectTypeMatiere(categorieComplete: string): TypeMatiere {
  const categorie = extractCategorie(categorieComplete).toLowerCase()
  
  if (CATEGORIES_BIJOUX.some(c => categorie.includes(c))) {
    return 'bijoux'
  }
  
  if (CATEGORIES_MAILLE.some(c => categorie.includes(c))) {
    return 'maille'
  }
  
  if (CATEGORIES_MARO.some(c => categorie.includes(c))) {
    return 'maro'
  }
  
  if (CATEGORIES_CUIR.some(c => categorie.includes(c))) {
    return 'cuir'
  }
  
  if (CATEGORIES_OBJETS.some(c => categorie.includes(c))) {
    return 'objets'
  }
  
  // Par défaut : tissus
  return 'tissus'
}

/**
 * Retourne les matières disponibles pour une catégorie
 */
export function getMatieresForCategorie(categorieComplete: string): string[] {
  const type = detectTypeMatiere(categorieComplete)
  return MATIERES[type]
}

/**
 * Toutes les matières possibles (pour le template Excel)
 */
export const ALL_MATIERES = [
  ...new Set([
    ...MATIERES.bijoux,
    ...MATIERES.maille,
    ...MATIERES.cuir,
    ...MATIERES.maro,
    ...MATIERES.tissus,
    ...MATIERES.objets,
  ])
]