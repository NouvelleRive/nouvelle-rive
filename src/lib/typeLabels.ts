// Libellés courts par slug de type (pour breadcrumbs / autres usages courts).
// La version longue marketing ("Sacs vintage et upcyclés") vit dans [type]/page.tsx.

export const TYPE_SHORT_FR: Record<string, string> = {
  haut: 'Hauts',
  'veste-manteau': 'Vestes & manteaux',
  robe: 'Robes',
  'jupe-short': 'Jupes & shorts',
  jupe: 'Jupes',
  short: 'Shorts',
  pantalon: 'Pantalons',
  pull: 'Pulls',
  'pull-gilet': 'Pulls & gilets',
  'gilet-pull': 'Gilets & pulls',
  chemise: 'Chemises',
  ensemble: 'Ensembles',
  combinaison: 'Combinaisons',
  sac: 'Sacs',
  portefeuille: 'Portefeuilles',
  chaussures: 'Chaussures',
  ceinture: 'Ceintures',
  chapeau: 'Chapeaux',
  casquette: 'Casquettes',
  echarpe: 'Écharpes',
  foulard: 'Foulards',
  gants: 'Gants',
  lunettes: 'Lunettes',
  accessoires: 'Accessoires',
  vase: 'Vases',
  bague: 'Bagues',
  collier: 'Colliers',
  bracelet: 'Bracelets',
  'boucles-d-oreilles': "Boucles d'oreilles",
  broche: 'Broches',
  broches: 'Broches',
  charms: 'Charms',
  earcuff: 'Earcuffs',
  piercing: 'Piercings',
  'bijou-de-cravates-et-foulards': 'Bijoux de cravate & foulard',
  'porte-briquet': 'Porte-briquets',
}

export const TYPE_SHORT_EN: Record<string, string> = {
  haut: 'Tops',
  'veste-manteau': 'Jackets & coats',
  robe: 'Dresses',
  'jupe-short': 'Skirts & shorts',
  jupe: 'Skirts',
  short: 'Shorts',
  pantalon: 'Pants',
  pull: 'Sweaters',
  'pull-gilet': 'Sweaters & cardigans',
  'gilet-pull': 'Cardigans & sweaters',
  chemise: 'Shirts',
  ensemble: 'Sets',
  combinaison: 'Jumpsuits',
  sac: 'Bags',
  portefeuille: 'Wallets',
  chaussures: 'Shoes',
  ceinture: 'Belts',
  chapeau: 'Hats',
  casquette: 'Caps',
  echarpe: 'Scarves',
  foulard: 'Silk scarves',
  gants: 'Gloves',
  lunettes: 'Glasses',
  accessoires: 'Accessories',
  vase: 'Vases',
  bague: 'Rings',
  collier: 'Necklaces',
  bracelet: 'Bracelets',
  'boucles-d-oreilles': 'Earrings',
  broche: 'Brooches',
  broches: 'Brooches',
  charms: 'Charms',
  earcuff: 'Ear cuffs',
  piercing: 'Piercings',
  'bijou-de-cravates-et-foulards': 'Tie & scarf jewelry',
  'porte-briquet': 'Lighter holders',
}

function fallbackShort(slug: string): string {
  const pretty = slug.replace(/-/g, ' ')
  return pretty.charAt(0).toUpperCase() + pretty.slice(1)
}

export function getTypeShortLabel(slug: string, lang: 'fr' | 'en' = 'fr'): string {
  if (lang === 'en') return TYPE_SHORT_EN[slug] || fallbackShort(slug)
  return TYPE_SHORT_FR[slug] || fallbackShort(slug)
}
