// lib/matieres.ts

// =====================
// CONSTANTES DE MATIÈRES
// =====================

export const MATIERES = {
  bijoux: ['Acier inoxydable', 'Argent', 'Fantaisie', 'Laiton', 'Or', 'Perles d\'eau douce', 'Perles de culture', 'Perles de synthèse', 'Pierres', 'Plaqué or', 'Vermeil'],
  maille: ['Acrylique', 'Alpaga', 'Angora', 'Cachemire', 'Coton', 'Fausse fourrure', 'Fourrure', 'Laine', 'Mérinos', 'Mohair'],
  cuir: ['Cuir', 'Cuir grainé', 'Cuir tressé', 'Cuir verni', 'Daim', 'Nubuck', 'Simili cuir'],
  maro: ['Cuir', 'Cuir grainé', 'Cuir verni', 'Daim', 'Nubuck', 'Simili cuir', 'Tissu', 'Toile'],
  tissus: ['Coton', 'Cuir', 'Daim', 'Denim', 'Dentelle', 'Fausse fourrure', 'Fourrure', 'Fourrure de lapin', 'Fourrure de mouton', 'Fourrure de renard', 'Fourrure de vison', 'Laine', 'Lin', 'Plumes', 'Polyester', 'Python', 'Satin', 'Sequins', 'Shearling', 'Simili cuir', 'Soie', 'Tweed', 'Velours', 'Viscose'],
  objets: ['Acétate', 'Céramique', 'Métal', 'Plastique recyclé', 'Résine', 'Verre'],
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