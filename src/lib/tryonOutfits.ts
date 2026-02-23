// lib/tryonOutfits.ts
// Prompts de styling par catégorie pour FASHN.ai Product-to-Model
// Modifier ici pour changer le look des mannequins

type OutfitConfig = {
  label: string
  // Chaque élément du tableau = une variante possible (choix aléatoire)
  accessories: string[]
}

// Helper : choisir un élément aléatoire dans un tableau
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── CONFIGURATIONS PAR CATÉGORIE ───────────────────────────────

const OUTFITS: Record<string, OutfitConfig> = {

  // ── HAUTS ──
  'haut': {
    label: 'Haut / Chemise',
    accessories: [
      'wearing wide leg trousers, square toe heels, plain white studio background',
      'wearing wide leg trousers, pointed toe heels, plain white studio background',
    ],
  },
  'chemise': {
    label: 'Chemise',
    accessories: [
      'wearing wide leg trousers, square toe heels, plain white studio background',
      'wearing wide leg trousers, pointed toe heels, plain white studio background',
    ],
  },

  // ── PULLS / GILETS ──
  'pull': {
    label: 'Pull / Gilet',
    accessories: [
      'wearing wide leg trousers, square toe heels, square black glasses, plain white studio background',
      'wearing wide leg trousers, pointed toe heels, square black glasses, plain white studio background',
    ],
  },
  'gilet': {
    label: 'Gilet',
    accessories: [
      'wearing wide leg trousers, square toe heels, square black glasses, plain white studio background',
      'wearing wide leg trousers, pointed toe heels, square black glasses, plain white studio background',
    ],
  },
  'pull / gilet': {
    label: 'Pull / Gilet',
    accessories: [
      'wearing wide leg trousers, square toe heels, square black glasses, plain white studio background',
      'wearing wide leg trousers, pointed toe heels, square black glasses, plain white studio background',
    ],
  },

  // ── MANTEAUX ──
  'manteau': {
    label: 'Manteau',
    accessories: [
      'wearing wide leg trousers, square toe heels, square black glasses with blue lenses, plain white studio background',
      'wearing wide leg trousers, pointed toe heels, square black glasses with blue lenses, plain white studio background',
    ],
  },
  'fourrure_longue': {
    label: 'Fourrure longue',
    accessories: [
      'wearing sheer black tights, high heels, square black sunglasses with blue lenses, fur chapka hat, plain white studio background',
    ],
  },
  'fourrure_courte': {
    label: 'Fourrure courte',
    accessories: [
      'wearing leather pants, pointed toe shoes, bangs hairstyle, plain white studio background',
    ],
  },

  // ── VESTES ──
  'veste': {
    label: 'Veste',
    accessories: [
      'wearing wide leg trousers, square toe heels, square black glasses with blue lenses, plain white studio background',
      'wearing wide leg trousers, pointed toe heels, square black glasses with blue lenses, plain white studio background',
    ],
  },
  'veste_cuir': {
    label: 'Veste en cuir',
    accessories: [
      'wearing square black sunglasses with blue lenses, plain white studio background',
      'wearing square black sunglasses, plain white studio background',
    ],
  },
  'blazer': {
    label: 'Blazer',
    accessories: [
      'wearing nothing underneath, wide leg cropped trousers, boots, square black sunglasses, plain white studio background',
      'wearing black turtleneck underneath, wide leg cropped trousers, boots, square black sunglasses, plain white studio background',
    ],
  },
'perfecto': {
    label: 'Perfecto',
    accessories: [
      'wearing oversized, wide leg trousers, square toe heels, plain white studio background',
      'wearing oversized, wide leg trousers, pointed toe heels, plain white studio background',
    ],
  },
  'veste_racing': {
    label: 'Veste Racing',
    accessories: [
      'wearing oversized, wide leg trousers, square toe heels, square black sunglasses, plain white studio background',
      'wearing oversized, wide leg trousers, pointed toe heels, square black sunglasses, plain white studio background',
    ],
  },
  'veste / manteau': {
    label: 'Veste / Manteau',
    accessories: [
      'wearing wide leg trousers, square toe heels, square black glasses with blue lenses, plain white studio background',
      'wearing wide leg trousers, pointed toe heels, square black glasses with blue lenses, plain white studio background',
    ],
  },

  // ── ROBES ──
  'robe': {
    label: 'Robe',
    accessories: [
      'wearing sheer dark blue tights, square toe heeled boots, plain white studio background',
      'wearing pointed toe heeled boots, bare legs, plain white studio background',
    ],
  },

  // ── JUPES / SHORTS ──
  'jupe': {
    label: 'Jupe',
    accessories: [
      'wearing a white turtleneck, sheer dark blue tights, square toe heeled boots, plain white studio background',
'wearing a black turtleneck, sheer dark blue tights, square toe heeled boots, plain white studio background',
      'wearing a lace-up top, pointed toe heeled boots, bare legs, plain white studio background',
    ],
  },
  'jupe / short': {
    label: 'Jupe / Short',
    accessories: [
      'wearing a white turtleneck, sheer dark blue tights, square toe heeled boots, plain white studio background',
'wearing a black turtleneck, sheer dark blue tights, square toe heeled boots, plain white studio background',
      'wearing a lace-up top, pointed toe heeled boots, bare legs, plain white studio background',
    ],
  },
  'short': {
    label: 'Short',
    accessories: [
      'wearing a white turtleneck, sheer dark blue tights, square toe heeled boots, plain white studio background',
'wearing a black turtleneck, sheer dark blue tights, square toe heeled boots, plain white studio background',
      'wearing a lace-up top, pointed toe heeled boots, bare legs, plain white studio background',
    ],
  },

  // ── PANTALONS ──
  'pantalon': {
    label: 'Pantalon',
    accessories: [
      'wearing heels, turtleneck sweater, stylish hat, plain white studio background',
    ],
  },

  // ── COMBINAISONS ──
  'combinaison': {
    label: 'Combinaison',
    accessories: [
      'wearing square black sunglasses, square toe heels, plain white studio background',
      'wearing square black sunglasses, pointed toe heels, plain white studio background',
    ],
  },

  // ── ENSEMBLES ──
  'ensemble': {
    label: 'Ensemble',
    accessories: [
      'wearing square black sunglasses, square toe heels, plain white studio background',
      'wearing square black sunglasses, pointed toe heels, plain white studio background',
    ],
  },
}

// Prompt par défaut si catégorie non trouvée
const DEFAULT_OUTFIT: OutfitConfig = {
  label: 'Défaut',
  accessories: [
    'wearing elegant wide leg trousers and heels, plain white studio background',
  ],
}

// ─── FONCTIONS PUBLIQUES ────────────────────────────────────────

/**
 * Retourne le prompt accessoires pour une catégorie donnée.
 * Détecte automatiquement fourrure/cuir depuis le nom ou la matière du produit.
 */
export function getOutfitPrompt(
  categorie: string,
  opts?: { nom?: string; matiere?: string }
): string {
  const SKIN_PREFIX = 'medium olive skin tone, '
  const _build = (prompt: string) => SKIN_PREFIX + prompt
  const cat = categorie.toLowerCase().trim()
  const nom = (opts?.nom || '').toLowerCase()
  const matiere = (opts?.matiere || '').toLowerCase()

  // Détection fourrure / cuir pour vestes et manteaux
  const isFourrure = nom.includes('fourrure') || matiere.includes('fourrure')
  const isCuir = nom.includes('cuir') || matiere.includes('cuir')

  // Fourrure longue = manteau en fourrure
  if (isFourrure && (cat.includes('manteau') || cat.includes('veste / manteau'))) {
    return pickRandom(OUTFITS['fourrure_longue'].accessories)
  }
  // Fourrure courte = veste en fourrure
  if (isFourrure && cat.includes('veste')) {
    return pickRandom(OUTFITS['fourrure_courte'].accessories)
  }
  // Manteau en cuir (chapka 50/50)
  if (isCuir && (cat.includes('manteau') || cat.includes('veste / manteau'))) {
    const manteauCuirAccessories = [
      'wearing wide leg trousers, square toe heels, square black glasses with blue lenses, fur chapka hat, plain white studio background',
      'wearing wide leg trousers, pointed toe heels, square black glasses with blue lenses, plain white studio background',
    ]
    return pickRandom(manteauCuirAccessories)
  }
  // Veste en cuir
  if (isCuir && (cat.includes('veste'))) {
    return pickRandom(OUTFITS['veste_cuir'].accessories)
  }
  // Blazer
  const isBlazer = nom.includes('blazer')
  if (isBlazer) {
    return pickRandom(OUTFITS['blazer'].accessories)
  }
  // Perfecto
  const isPerfecto = nom.includes('perfecto')
  if (isPerfecto) {
    return pickRandom(OUTFITS['perfecto'].accessories)
  }
  // Racing
  const isRacing = nom.includes('racing')
  if (isRacing) {
    return pickRandom(OUTFITS['veste_racing'].accessories)
  }
  // Jupes/shorts : collants nude si pas noir
  if (cat.includes('jupe') || cat.includes('short')) {
    const isNoir = nom.includes('noir') || nom.includes('black')
    if (!isNoir) {
      return pickRandom([
        'wearing a white turtleneck, bare legs, square toe heeled boots, plain white studio background',
        'wearing a black turtleneck, sheer nude tights, square toe heeled boots, plain white studio background',
        'wearing a lace-up top, pointed toe heeled boots, bare legs, plain white studio background',
      ])
    }
    return pickRandom(OUTFITS['jupe'].accessories)
  }
  // Recherche par catégorie exacte
  if (OUTFITS[cat]) {
    return pickRandom(OUTFITS[cat].accessories)
  }
  // Recherche partielle (ex: "FRU - Jupe / Short" → contient "jupe")
  for (const [key, config] of Object.entries(OUTFITS)) {
    if (!key.includes('_') && cat.includes(key)) {
      return pickRandom(config.accessories)
    }
  }

  return pickRandom(DEFAULT_OUTFIT.accessories)
}

/**
 * Liste toutes les catégories configurées (pour debug/admin)
 */
export function getAllOutfitCategories(): { key: string; label: string }[] {
  return Object.entries(OUTFITS).map(([key, config]) => ({
    key,
    label: config.label,
  }))
}