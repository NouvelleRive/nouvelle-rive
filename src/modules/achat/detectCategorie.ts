// Détection automatique de la catégorie d'un produit à partir de son titre
// (Vinted/Whatnot/etc.) en croisant des mots-clés avec la liste des catégories
// autorisées de la chineuse cible.
//
// Pourquoi : sans ça, le brouillon importé arrive sans catégorie et il faut la
// renseigner à la main. Avec ça, ~80% des cas sont auto-détectés et l'admin
// n'a qu'à corriger la minorité.

/**
 * Mots-clés (en lowercase, sans accent) qui signalent une famille de pièce.
 * Quand l'un de ces mots est trouvé dans le titre, on cherche dans la liste
 * des catégories de la chineuse celle qui contient le même mot.
 */
const KEYWORDS: Record<string, string[]> = {
  // Prêt-à-porter
  robe: ['robe'],
  jean: ['jean', 'pantalon'],
  pantalon: ['pantalon', 'jean'],
  short: ['short'],
  jupe: ['jupe'],
  top: ['haut', 'top', 'tshirt', 't-shirt', 'tee shirt'],
  haut: ['haut', 'top'],
  tshirt: ['t-shirt', 'tshirt', 'haut'],
  't-shirt': ['t-shirt', 'haut'],
  debardeur: ['debardeur', 'haut', 'top'],
  chemise: ['chemise', 'haut'],
  blouse: ['blouse', 'haut'],
  pull: ['pull', 'gilet'],
  gilet: ['gilet', 'pull'],
  veste: ['veste', 'blazer', 'manteau'],
  blazer: ['veste', 'blazer'],
  manteau: ['manteau', 'veste'],
  combinaison: ['combinaison'],
  ensemble: ['ensemble'],
  maillot: ['maillot', 'bain'],
  body: ['body'],
  // Maroquinerie
  sac: ['sac'],
  portefeuille: ['portefeuille'],
  // Chaussures
  chaussure: ['chaussure'],
  baskets: ['basket', 'chaussure'],
  bottes: ['botte', 'chaussure'],
  sandales: ['sandale', 'chaussure'],
  // Accessoires
  foulard: ['foulard', 'echarpe', 'chale'],
  echarpe: ['echarpe', 'foulard'],
  ceinture: ['ceinture'],
  chapeau: ['chapeau'],
  bonnet: ['bonnet'],
  // Bijoux
  bague: ['bague'],
  bracelet: ['bracelet'],
  collier: ['collier'],
  boucles: ['boucle', 'oreille'],
  broche: ['broche'],
  earcuff: ['earcuff'],
  charm: ['charm'],
  piercing: ['piercing'],
}

/** Catégorie de la chineuse (forme stockée dans le doc Firestore). */
export type CategorieEntry = {
  label?: string
  idsquare?: string
}

/**
 * Tente de détecter la catégorie d'une pièce à partir de son titre.
 * Retourne l'entrée catégorie (avec label + idsquare) ou `null` si aucun match.
 */
export function detectCategorieFromTitre(
  titre: string,
  categoriesChineuse: CategorieEntry[]
): CategorieEntry | null {
  if (!titre || !categoriesChineuse?.length) return null
  const norm = normalize(titre)
  // On collecte tous les keywords cibles trouvés dans le titre
  const targets = new Set<string>()
  for (const [trigger, mapped] of Object.entries(KEYWORDS)) {
    if (containsWord(norm, trigger)) {
      mapped.forEach((m) => targets.add(m))
    }
  }
  if (targets.size === 0) return null

  // Pour chaque catégorie chineuse, on regarde si son label contient un keyword cible
  for (const cat of categoriesChineuse) {
    const lbl = normalize(cat.label || '')
    for (const target of targets) {
      if (lbl.includes(target)) return cat
    }
  }
  return null
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9 -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Recherche du mot entier (avec frontières) pour éviter "robe" dans "robes" → no, regex \b. */
function containsWord(text: string, word: string): boolean {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i')
  return re.test(text)
}
