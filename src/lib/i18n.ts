'use client'

import { useEffect, useState } from 'react'

export type Lang = 'fr' | 'en'
const STORAGE_KEY = 'nr-lang'
const CHANGE_EVENT = 'nr-lang-change'

export function getStoredLang(): Lang {
  if (typeof window === 'undefined') return 'fr'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return saved === 'en' ? 'en' : 'fr'
}

export function setStoredLang(lang: Lang) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, lang)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>('fr')

  useEffect(() => {
    setLang(getStoredLang())
    const refresh = () => setLang(getStoredLang())
    window.addEventListener('storage', refresh)
    window.addEventListener(CHANGE_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(CHANGE_EVENT, refresh)
    }
  }, [])

  return lang
}

export function t(fr: string, en: string, lang: Lang): string {
  return lang === 'en' ? en : fr
}

// Traductions FR → EN des catégories produits (macro + sous-catégories)
const CATEGORY_EN: Record<string, string> = {
  // Macro
  'prêt-à-porter': 'Ready-to-wear',
  'maroquinerie': 'Leather goods',
  'bijoux': 'Jewelry',
  'chaussures': 'Shoes',
  'accessoires': 'Accessories',
  // Vêtements
  'haut': 'Top',
  'chemise': 'Shirt',
  'pull': 'Knitwear',
  'gilet': 'Cardigan',
  'pull / gilet': 'Knitwear / Cardigan',
  'veste': 'Jacket',
  'manteau': 'Coat',
  'veste / manteau': 'Jacket / Coat',
  'robe': 'Dress',
  'pantalon': 'Trousers',
  'jupe': 'Skirt',
  'jupe / short': 'Skirt / Shorts',
  'short': 'Shorts',
  'ensemble': 'Set',
  'combinaison': 'Jumpsuit',
  // Maroquinerie
  'sac': 'Bag',
  'portefeuille': 'Wallet',
  'porte clef': 'Keyring',
  // Accessoires
  'ceinture': 'Belt',
  'chapeau': 'Hat',
  'casquette': 'Cap',
  'écharpe': 'Scarf',
  'foulard': 'Silk scarf',
  'gants': 'Gloves',
  'lunettes': 'Sunglasses',
  'vase': 'Vase',
  'porte briquet': 'Lighter holder',
  // Bijoux
  'bague': 'Ring',
  "boucles d'oreilles": 'Earrings',
  'bracelet': 'Bracelet',
  'collier': 'Necklace',
  'broche': 'Brooch',
  'broches': 'Brooches',
  'charms': 'Charms',
  'earcuff': 'Ear cuff',
  'piercing': 'Piercing',
  'bijou de cravates et foulards': 'Tie & scarf jewelry',
}

// Traduit une chaîne catégorie (gère "Veste / Manteau" → "Jacket / Coat")
export function translateCategory(fr: string, lang: Lang): string {
  if (lang !== 'en' || !fr) return fr
  const trimmed = fr.trim()
  const direct = CATEGORY_EN[trimmed.toLowerCase()]
  if (direct) {
    return trimmed === trimmed.toUpperCase() ? direct.toUpperCase() : direct
  }
  if (/\s*[\/\-–]\s*/.test(trimmed)) {
    const parts = trimmed.split(/\s*[\/\-–]\s*/).map((p) => translateCategory(p, lang))
    return parts.join(' / ')
  }
  return fr
}

// === DICTIONNAIRES POUR LES NOMS DE PRODUITS (matières / modèles / motifs / couleurs) ===

const MATERIAL_EN: Record<string, string> = {
  // Bijoux
  'acier inoxydable': 'stainless steel',
  'argent': 'silver',
  'fantaisie': 'costume',
  'laiton': 'brass',
  'or': 'gold',
  "perles d'eau douce": 'freshwater pearls',
  'perles de culture': 'cultured pearls',
  'perles de synthèse': 'faux pearls',
  'pierres': 'stones',
  'plaqué or': 'gold-plated',
  'vermeil': 'vermeil',
  // Maille / textile
  'acrylique': 'acrylic',
  'alpaga': 'alpaca',
  'angora': 'angora',
  'cachemire': 'cashmere',
  'coton': 'cotton',
  'fausse fourrure': 'faux fur',
  'fourrure': 'fur',
  'fourrure de lapin': 'rabbit fur',
  'fourrure de mouton': 'shearling',
  'fourrure de renard': 'fox fur',
  'fourrure de vison': 'mink fur',
  'laine': 'wool',
  'mérinos': 'merino',
  'mohair': 'mohair',
  'cuir': 'leather',
  'cuir grainé': 'grained leather',
  'cuir tressé': 'braided leather',
  'cuir verni': 'patent leather',
  'daim': 'suede',
  'nubuck': 'nubuck',
  'simili cuir': 'faux leather',
  'denim': 'denim',
  'dentelle': 'lace',
  'lin': 'linen',
  'plumes': 'feathers',
  'polyester': 'polyester',
  'python': 'python',
  'satin': 'satin',
  'sequins': 'sequins',
  'shearling': 'shearling',
  'soie': 'silk',
  'tweed': 'tweed',
  'velours': 'velvet',
  'viscose': 'viscose',
  'tissu': 'fabric',
  'toile': 'canvas',
  // Objets
  'acétate': 'acetate',
  'céramique': 'ceramic',
  'métal': 'metal',
  'plastique recyclé': 'recycled plastic',
  'résine': 'resin',
  'verre': 'glass',
}

const MOTIF_EN: Record<string, string> = {
  'uni': 'plain',
  'rayures': 'striped',
  'carreaux': 'checked',
  'tartan': 'tartan',
  'carreaux / tartan': 'checked / tartan',
  'pied-de-poule': 'houndstooth',
  'vichy': 'gingham',
  'fleurs': 'floral',
  'léopard': 'leopard',
  'animal': 'animal print',
  'léopard / animal': 'leopard / animal print',
  'camouflage': 'camouflage',
  'pois': 'polka dot',
  'géométrique': 'geometric',
  'abstrait': 'abstract',
}

const MODELE_EN: Record<string, string> = {
  // Hauts
  'blouse': 'blouse',
  'body': 'bodysuit',
  'bustier': 'bustier',
  'chemise': 'shirt',
  'corset': 'corset',
  'crop top': 'crop top',
  'débardeur': 'tank top',
  'polo': 'polo',
  't-shirt': 't-shirt',
  'top': 'top',
  // Pulls
  'cardigan': 'cardigan',
  'col roulé': 'turtleneck',
  'col v': 'V-neck',
  'pull col rond': 'crewneck',
  'gilet': 'cardigan',
  'hoodie': 'hoodie',
  'sweat': 'sweatshirt',
  // Vestes / manteaux
  'blazer': 'blazer',
  'blouson': 'jacket',
  'bomber': 'bomber',
  'caban': 'pea coat',
  'cape': 'cape',
  'doudoune': 'puffer jacket',
  'manteau': 'coat',
  'parka': 'parka',
  'perfecto': 'biker jacket',
  'poncho': 'poncho',
  'saharienne': 'safari jacket',
  'teddy': 'varsity jacket',
  'trench': 'trench coat',
  'veste en jean': 'denim jacket',
  // Robes
  'ample': 'flowy',
  'fourreau': 'sheath',
  'fine': 'slip',
  'longue': 'long',
  'courte': 'short',
  'midi': 'midi',
  'mini': 'mini',
  'maxi': 'maxi',
  // Pantalons
  'bootcut': 'bootcut',
  'cargo': 'cargo',
  'carotte': 'tapered',
  'cigarette': 'cigarette',
  'droit': 'straight',
  'flare': 'flare',
  "patte d'eph": 'flared',
  'flare / patte d\'eph': 'flared',
  'large': 'wide',
  'palazzo': 'palazzo',
  'large / palazzo': 'palazzo',
  'mom': 'mom',
  'skinny': 'skinny',
  'slim': 'slim',
  'taille basse': 'low rise',
  'taille haute': 'high rise',
  // Jupes / shorts
  'crayon': 'pencil',
  'plissée': 'pleated',
  'patineuse': 'skater',
  'asymétrique': 'asymmetric',
  // Sacs
  'cabas': 'tote',
  'banane': 'belt bag',
  'bandoulière': 'crossbody',
  'baguette': 'baguette',
  'besace': 'messenger',
  'bowling': 'bowling',
  'clutch': 'clutch',
  'pochette': 'pouch',
  'shopping': 'shopping',
  'seau': 'bucket',
  'sac à dos': 'backpack',
  // Chaussures
  'ballerines': 'flats',
  'baskets': 'sneakers',
  'bottes': 'boots',
  'bottines': 'ankle boots',
  'cuissardes': 'thigh-high boots',
  'derbies': 'derbies',
  'escarpins': 'pumps',
  'mules': 'mules',
  'sandales': 'sandals',
  'tongs': 'flip-flops',
  // Bijoux modèles
  'alliance': 'wedding band',
  'chevalière': 'signet ring',
  'jonc': 'bangle',
  'créoles': 'hoop earrings',
  'dormeuses': 'sleeper earrings',
  'clips': 'clip-on',
  'choker': 'choker',
  'sautoir': 'long necklace',
  'pendentif': 'pendant',
  'chaîne': 'chain',
  // Accessoires
  'béret': 'beret',
  'bob': 'bucket hat',
  'capeline': 'wide-brim hat',
  'casquette': 'cap',
  'fedora': 'fedora',
  'panama': 'panama hat',
}

const COLOR_EN: Record<string, string> = {
  'noir': 'black',
  'blanc': 'white',
  'écru': 'ecru',
  'crème': 'cream',
  'ivoire': 'ivory',
  'beige': 'beige',
  'nude': 'nude',
  'sable': 'sand',
  'camel': 'camel',
  'cognac': 'cognac',
  'fauve': 'tan',
  'marron': 'brown',
  'taupe': 'taupe',
  'gris': 'grey',
  'anthracite': 'charcoal',
  'rouge': 'red',
  'bordeaux': 'burgundy',
  'brique': 'brick red',
  'rouille': 'rust',
  'terracotta': 'terracotta',
  'corail': 'coral',
  'rose': 'pink',
  'fuchsia': 'fuchsia',
  'orange': 'orange',
  'jaune': 'yellow',
  'champagne': 'champagne',
  'vert': 'green',
  'kaki': 'khaki',
  'olive': 'olive',
  'bleu marine': 'navy',
  'bleu': 'blue',
  'bleu ciel': 'sky blue',
  'turquoise': 'turquoise',
  'violet': 'purple',
  'mauve': 'mauve',
  'lilas': 'lilac',
  'lavande': 'lavender',
  'prune': 'plum',
  'aubergine': 'eggplant',
  'argenté': 'silver',
  'doré': 'gold',
  'multicolore': 'multicolor',
}

function lookupWithCase(value: string, dict: Record<string, string>): string | null {
  const k = value.trim().toLowerCase()
  const direct = dict[k]
  if (!direct) return null
  // Préserve la casse d'origine (UPPER, Capitalized, lower)
  if (value === value.toUpperCase()) return direct.toUpperCase()
  if (value[0] === value[0]?.toUpperCase()) return direct[0].toUpperCase() + direct.slice(1)
  return direct
}

function translateWithDict(value: string, dict: Record<string, string>, lang: Lang): string {
  if (lang !== 'en' || !value) return value
  const direct = lookupWithCase(value.trim(), dict)
  if (direct) return direct
  // gère séparateurs '/', '-', ','
  if (/\s*[\/,]\s*/.test(value)) {
    return value
      .split(/\s*[\/,]\s*/)
      .map((p) => translateWithDict(p, dict, lang))
      .join(', ')
  }
  return value
}

export const translateMaterial = (fr: string, lang: Lang) => translateWithDict(fr, MATERIAL_EN, lang)
export const translateMotif = (fr: string, lang: Lang) => translateWithDict(fr, MOTIF_EN, lang)
export const translateModele = (fr: string, lang: Lang) => translateWithDict(fr, MODELE_EN, lang)
export const translateColor = (fr: string, lang: Lang) => translateWithDict(fr, COLOR_EN, lang)

// Traduit chaque mot connu d'un titre de produit (matières/modèles/couleurs/motifs)
// Utilisé pour les `nom` produits tapés librement par les chineuses
export function translateProductTitle(title: string, lang: Lang): string {
  if (lang !== 'en' || !title) return title
  const allDicts: Record<string, string> = {
    ...MATERIAL_EN,
    ...MODELE_EN,
    ...COLOR_EN,
    ...MOTIF_EN,
  }
  // Découpe sur les espaces tout en préservant la ponctuation
  return title
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token) || !token) return token
      // Strip ponctuation finale pour le lookup, on la remet ensuite
      const m = token.match(/^([\p{L}\d'’\-]+)([^\p{L}\d]*)$/u)
      if (!m) return token
      const word = m[1]
      const tail = m[2]
      const tr = lookupWithCase(word, allDicts)
      return tr ? tr + tail : token
    })
    .join('')
}
