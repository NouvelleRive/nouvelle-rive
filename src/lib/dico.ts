/**
 * dico.ts — Dictionnaire centralisé FR → EN
 * Utilisé par eBay, Depop, Etsy, Google Shopping, etc.
 */

/** Normalise un texte : minuscule + supprime les accents */
function normalize(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/e?s?$/, '').trim()
}

// ============================================================
// MATIÈRES
// ============================================================
export const MATERIALS: Record<string, string> = {
  // Cuirs
  'cuir': 'Leather',
  'cuir véritable': 'Genuine Leather',
  'cuir verni': 'Patent Leather',
  'cuir matelassé': 'Quilted Leather',
  'cuir tressé': 'Woven Leather',
  'cuir grainé': 'Grained Leather',
  'cuir lisse': 'Smooth Leather',
  'cuir souple': 'Soft Leather',
  'cuir pleine fleur': 'Full Grain Leather',
  "cuir d'agneau": 'Lambskin',
  'cuir de veau': 'Calfskin',
  'cuir de chèvre': 'Goatskin',
  'cuir exotique': 'Exotic Leather',
  'daim': 'Suede',
  'nubuck': 'Nubuck',
  'peau de serpent': 'Snakeskin',
  'peau de crocodile': 'Crocodile',
  'peau de python': 'Python',
  "peau d'autruche": 'Ostrich',
  'peau retournée': 'Shearling',

  // Textiles classiques
  'soie': 'Silk',
  'coton': 'Cotton',
  'laine': 'Wool',
  'lin': 'Linen',
  'lin mélangé': 'Linen Blend',
  'laine mélangée': 'Wool Blend',
  'coton mélangé': 'Cotton Blend',
  'soie mélangée': 'Silk Blend',
  'cachemire': 'Cashmere',
  'mohair': 'Mohair',
  'alpaga': 'Alpaca',
  'angora': 'Angora',
  'tweed': 'Tweed',
  'jersey': 'Jersey',
  'maille': 'Knit',

  // Textiles fins
  'satin': 'Satin',
  'velours': 'Velvet',
  'mousseline': 'Chiffon',
  'organza': 'Organza',
  'tulle': 'Tulle',
  'crêpe': 'Crepe',
  'dentelle': 'Lace',
  'broderie': 'Embroidery',
  'jacquard': 'Jacquard',
  'brocart': 'Brocade',
  'taffetas': 'Taffeta',
  'gaze': 'Gauze',
  'georgette': 'Georgette',

  // Synthétiques
  'polyester': 'Polyester',
  'nylon': 'Nylon',
  'viscose': 'Viscose',
  'rayonne': 'Rayon',
  'acétate': 'Acetate',
  'acrylique': 'Acrylic',
  'élasthanne': 'Elastane',
  'lycra': 'Lycra',
  'spandex': 'Spandex',
  'synthétique': 'Synthetic',
  'microfibre': 'Microfiber',

  // Autres
  'toile': 'Canvas',
  'toile oblique': 'Oblique Canvas',
  'toile monogram': 'Monogram Canvas',
  'toile monogrammée': 'Monogram Canvas',
  'jean': 'Denim',
  'denim': 'Denim',
  'fourrure': 'Fur',
  'fausse fourrure': 'Faux Fur',
  'paille': 'Straw',
  'raphia': 'Raffia',
  'osier': 'Wicker',
  'liège': 'Cork',
  'caoutchouc': 'Rubber',
  'plastique': 'Plastic',
  'PVC': 'PVC',
  'métal': 'Metal',
  'laiton': 'Brass',
  'or': 'Gold',
  'argent': 'Silver',
  'plaqué or': 'Gold Plated',

  // Finitions / qualificatifs matière
  'matelassé': 'Quilted',
  'verni': 'Patent',
  'tressé': 'Woven',
  'imprimé': 'Printed',
  'brodé': 'Embroidered',
  'perlé': 'Beaded',
  'clouté': 'Studded',
  'perforé': 'Perforated',
  'froissé': 'Crinkled',
  'plissé': 'Pleated',
  'texturé': 'Textured',
  'monogrammé': 'Monogrammed',
}

// ============================================================
// COULEURS
// ============================================================
export const COLORS: Record<string, string> = {
  'noir': 'Black',
  'blanc': 'White',
  'rouge': 'Red',
  'bleu': 'Blue',
  'bleu marine': 'Navy Blue',
  'bleu ciel': 'Sky Blue',
  'bleu roi': 'Royal Blue',
  'bleu électrique': 'Electric Blue',
  'vert': 'Green',
  'vert olive': 'Olive Green',
  'vert émeraude': 'Emerald Green',
  'vert sapin': 'Forest Green',
  'jaune': 'Yellow',
  'rose': 'Pink',
  'rose poudré': 'Dusty Pink',
  'rose fuchsia': 'Fuchsia',
  'gris': 'Gray',
  'gris anthracite': 'Charcoal Gray',
  'gris clair': 'Light Gray',
  'marron': 'Brown',
  'beige': 'Beige',
  'bordeaux': 'Burgundy',
  'marine': 'Navy',
  'doré': 'Gold',
  'argenté': 'Silver',
  'orange': 'Orange',
  'violet': 'Purple',
  'mauve': 'Mauve',
  'lilas': 'Lilac',
  'lavande': 'Lavender',
  'crème': 'Cream',
  'ivoire': 'Ivory',
  'écru': 'Ecru',
  'camel': 'Camel',
  'cognac': 'Cognac',
  'fauve': 'Tan',
  'taupe': 'Taupe',
  'sable': 'Sand',
  'nude': 'Nude',
  'kaki': 'Khaki',
  'corail': 'Coral',
  'turquoise': 'Turquoise',
  'cyan': 'Cyan',
  'magenta': 'Magenta',
  'rouille': 'Rust',
  'brique': 'Brick',
  'terracotta': 'Terracotta',
  'prune': 'Plum',
  'aubergine': 'Eggplant',
  'champagne': 'Champagne',
  'cuivre': 'Copper',
  'bronze': 'Bronze',
  'multicolore': 'Multicolor',
  'bicolore': 'Two-Tone',
  'imprimé': 'Print',
}

// ============================================================
// TYPES DE PRODUITS (phrases composées)
// ============================================================
export const PRODUCT_TYPES: Record<string, string> = {
  // Sacs
  'sac à main': 'Handbag',
  'sac à dos': 'Backpack',
  'sac à bandoulière': 'Crossbody Bag',
  'sac bandoulière': 'Crossbody Bag',
  'sac seau': 'Bucket Bag',
  'sac cabas': 'Tote Bag',
  'sac banane': 'Belt Bag',
  'sac de voyage': 'Travel Bag',
  'sac pochette': 'Clutch Bag',
  'sac bourse': 'Pouch Bag',
  'sac shopping': 'Shopping Bag',
  'sac hobo': 'Hobo Bag',
  'pochette': 'Clutch',
  'besace': 'Messenger Bag',
  'cabas': 'Tote',
  'minaudière': 'Minaudière',
  'porte-monnaie': 'Coin Purse',
  'portefeuille': 'Wallet',
  'porte-cartes': 'Card Holder',

  // Vêtements hauts
  'veste en jean': 'Denim Jacket',
  'veste en cuir': 'Leather Jacket',
  'veste en daim': 'Suede Jacket',
  'veste en tweed': 'Tweed Jacket',
  'veste de costume': 'Blazer',
  'doudoune': 'Puffer Jacket',
  'trench': 'Trench Coat',
  'pardessus': 'Overcoat',
  'imperméable': 'Raincoat',
  'blouson': 'Bomber Jacket',
  'cape': 'Cape',
  'poncho': 'Poncho',
  'gilet': 'Vest',
  'cardigan': 'Cardigan',
  'débardeur': 'Tank Top',
  'chemisier': 'Blouse',
  'veste tailleur': 'Tailored Jacket',

  // Vêtements bas
  'jupe crayon': 'Pencil Skirt',
  'jupe plissée': 'Pleated Skirt',
  'jupe trapèze': 'A-Line Skirt',
  'jupe fourreau': 'Pencil Skirt',
  'pantalon droit': 'Straight Pants',
  'pantalon large': 'Wide Leg Pants',
  'pantalon cigarette': 'Cigarette Pants',
  'jean slim': 'Slim Jeans',
  'jean droit': 'Straight Jeans',
  'jean bootcut': 'Bootcut Jeans',
  'jean flare': 'Flare Jeans',
  'short': 'Shorts',
  'bermuda': 'Bermuda Shorts',

  // Robes
  'robe longue': 'Maxi Dress',
  'robe courte': 'Mini Dress',
  'robe midi': 'Midi Dress',
  'robe de soirée': 'Evening Dress',
  'robe de cocktail': 'Cocktail Dress',
  'robe chemise': 'Shirt Dress',
  'robe fourreau': 'Sheath Dress',
  'robe trapèze': 'A-Line Dress',
  'combinaison': 'Jumpsuit',
  'combishort': 'Romper',

  // Chaussures
  'escarpins': 'Pumps',
  'talons': 'Heels',
  'sandales': 'Sandals',
  'bottines': 'Ankle Boots',
  'bottes': 'Boots',
  'mocassins': 'Loafers',
  'baskets': 'Sneakers',
  'ballerines': 'Ballet Flats',
  'mules': 'Mules',
  'derbies': 'Derby Shoes',
  'richelieu': 'Oxford Shoes',
  'compensées': 'Wedges',
  'tongs': 'Flip Flops',
  'espadrilles': 'Espadrilles',

  // Accessoires
  'ceinture': 'Belt',
  'écharpe': 'Scarf',
  'foulard': 'Silk Scarf',
  'chapeau': 'Hat',
  'bonnet': 'Beanie',
  'béret': 'Beret',
  'gants': 'Gloves',
  'lunettes de soleil': 'Sunglasses',
  'montre': 'Watch',
  'collier': 'Necklace',
  'bracelet': 'Bracelet',
  'boucles d\'oreilles': 'Earrings',
  'bague': 'Ring',
  'broche': 'Brooch',
  'barrette': 'Hair Clip',
  'bandeau': 'Headband',
  'à motif': 'Patterned',
  'à motifs': 'Patterned',
}

// ============================================================
// MOTS SIMPLES (pour traduction titre mot-à-mot)
// ============================================================
export const WORDS: Record<string, string> = {
  'vintage': 'Vintage',
  'robe': 'Dress',
  'jupe': 'Skirt',
  'pantalon': 'Pants',
  'manteau': 'Coat',
  'veste': 'Jacket',
  'blazer': 'Blazer',
  'pull': 'Sweater',
  'gilet': 'Vest',
  'chemise': 'Shirt',
  'chemisier': 'Blouse',
  'top': 'Top',
  'haut': 'Top',
  'tailleur': 'Tailored',
  'sac': 'Bag',
  'ceinture': 'Belt',
  'écharpe': 'Scarf',
  'foulard': 'Scarf',
  'chapeau': 'Hat',
  'chaussures': 'Shoes',
  'bottes': 'Boots',
  'bottines': 'Ankle Boots',
  'sandales': 'Sandals',
  'escarpins': 'Pumps',
  'baskets': 'Sneakers',
  'mocassins': 'Loafers',
  'bijoux': 'Jewelry',
  'collier': 'Necklace',
  'bracelet': 'Bracelet',
  'broche': 'Brooch',
  'bague': 'Ring',
  'lunettes': 'Glasses',
  'montre': 'Watch',
  'fourreau': 'Pencil',
  'épaisse': 'Thick',
  'épais': 'Thick',
  'boutons': 'Buttons',
  'bouton': 'Button',
  'doublure': 'Lining',
  'matelassé': 'Quilted',
  'en': '',
  'de': '',
  'du': '',
  'des': '',
  'le': '',
  'la': '',
  'les': '',
  'un': '',
  'une': '',
  'avec': 'with',
  'et': 'and',
  'sans': 'without',
  'à': '',
  'très': '',
  'col': 'Collar',
  'motif': 'Pattern',
  'motifs': 'Pattern',
  'léger': 'Light',
  'longue': 'Long',
  'brillant': 'Shiny',
  'glacé': 'Glossy',
  'iconique': 'iconic',
  'bandes': 'Stripes',
  'rayures': 'Striped',
  'cargo': 'Cargo',
  'bomber': 'Bomber',
  'bombers': 'Bomber',
  'polo': 'Polo',
  'mélangé': 'Blend',
  'rayé': 'Striped',
  'imprimé': 'Printed',
  'petit': 'Small',
  'grand': 'Large',
  'long': 'Long',
  'court': 'Short',
  'oversize': 'Oversized',
  'ajusté': 'Fitted',
  'ample': 'Loose',
  'cintré': 'Fitted',
  'fluide': 'Flowy',
  'structuré': 'Structured',
  'femme': "Women's",
  'homme': "Men's",
  'mixte': 'Unisex',
}

// ============================================================
// CATÉGORIES eBay (sous-catégories → category ID)
// ============================================================
export const EBAY_CATEGORIES: Record<string, string> = {
  'bags': '169291',
  'coats': '63862',
  'dresses': '63861',
  'tops': '53159',
  'pants': '63863',
  'skirts': '63864',
  'sweaters': '63866',
  'shoes': '63889',
  'accessories': '4250',
}

// ============================================================
// FONCTIONS DE TRADUCTION
// ============================================================

/**
 * Traduit une matière FR → EN
 * Cherche d'abord les expressions composées, puis les mots simples
 */
export function translateMaterial(material: string): string {
  if (!material) return ''
  const norm = normalize(material)

  const sortedKeys = Object.keys(MATERIALS).sort((a, b) => b.length - a.length)
  for (const key of sortedKeys) {
    if (norm.includes(normalize(key))) {
      return MATERIALS[key]
    }
  }

  if (material[0] === material[0].toUpperCase()) return material
  return material
}

/**
 * Traduit une couleur FR → EN
 */
export function translateColor(color: string): string {
  if (!color) return ''
  const norm = normalize(color)

  const sortedKeys = Object.keys(COLORS).sort((a, b) => b.length - a.length)
  for (const key of sortedKeys) {
    if (norm.includes(normalize(key))) {
      return COLORS[key]
    }
  }

  if (color[0] === color[0].toUpperCase()) return color
  return color
}

/**
 * Traduit un titre produit FR → EN
 * Cherche d'abord les phrases composées, puis mot par mot
 */
export function translateTitle(title: string): string {
  if (!title) return ''
  let result = title

  // 1. Remplacer les phrases composées (les plus longues d'abord)
  const allPhrases = { ...PRODUCT_TYPES, ...MATERIALS }
  const sortedPhrases = Object.keys(allPhrases).sort((a, b) => b.length - a.length)

  for (const phrase of sortedPhrases) {
    const normResult = normalize(result)
    const normPhrase = normalize(phrase)
    const idx = normResult.indexOf(normPhrase)
    if (idx !== -1) {
      const before = idx === 0 || normResult[idx - 1] === ' '
      const after = idx + normPhrase.length >= normResult.length || normResult[idx + normPhrase.length] === ' '
      if (before && after) {
        result = result.substring(0, idx) + allPhrases[phrase] + result.substring(idx + phrase.length)
      }
    }
  }

  // 2. Remplacer les mots individuels
  const words = result.split(/\s+/)
  const translated = words.map(word => {
    const clean = word.toLowerCase().replace(/[^a-zà-ÿ]/g, '')
    const cleanNorm = normalize(clean)
    const wordMatch = Object.entries({ ...WORDS, ...COLORS, ...MATERIALS }).find(([k]) => normalize(k) === cleanNorm)
    if (wordMatch) {
      const prefix = word.match(/^[^a-zà-ÿA-ZÀ-Ÿ]*/)?.[0] || ''
      const suffix = word.match(/[^a-zà-ÿA-ZÀ-Ÿ]*$/)?.[0] || ''
      return prefix + wordMatch[1] + suffix
    }
    return word
  })

  // Nettoyer les espaces doubles et les mots vides
  return translated
    .filter(w => w.trim() !== '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}