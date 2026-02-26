// lib/tryonOutfitsEte.ts
// Prompts de styling ÉTÉ par catégorie pour FASHN.ai Product-to-Model

type OutfitConfig = {
  label: string
  accessories: string[]
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function withGlasses(prompt: string): string {
  const glasses = Math.random() < 0.1
    ? 'square black glasses with blue lenses'
    : 'square black sunglasses'
  return prompt.replace('square black sunglasses', glasses)
}

const OUTFITS: Record<string, OutfitConfig> = {

  // ── HAUTS ──
  'haut': {
    label: 'Haut / Chemise',
    accessories: [
      'wearing linen wide leg trousers, open toe heeled sandals, square black sunglasses, plain white studio background',
      'wearing a midi skirt, strappy sandals, square black sunglasses, plain white studio background',
    ],
  },
  'chemise': {
    label: 'Chemise',
    accessories: [
      'wearing linen wide leg trousers, open toe heeled sandals, square black sunglasses, plain white studio background',
      'wearing a midi skirt, strappy sandals, square black sunglasses, plain white studio background',
    ],
  },

  // ── PULLS / GILETS ──
  'pull': {
    label: 'Pull / Gilet',
    accessories: [
      'wearing wide leg trousers, open toe heeled mules, square black sunglasses, plain white studio background',
      'wearing wide leg trousers, strappy sandals, square black sunglasses, plain white studio background',
    ],
  },
  'gilet': {
    label: 'Gilet',
    accessories: [
      'wearing wide leg trousers, open toe heeled mules, square black sunglasses, plain white studio background',
      'wearing wide leg trousers, strappy sandals, square black sunglasses, plain white studio background',
    ],
  },
  'pull / gilet': {
    label: 'Pull / Gilet',
    accessories: [
      'wearing wide leg trousers, open toe heeled mules, square black sunglasses, plain white studio background',
      'wearing wide leg trousers, strappy sandals, square black sunglasses, plain white studio background',
    ],
  },

  // ── MANTEAUX ──
  'manteau': {
    label: 'Manteau',
    accessories: [
      'wearing wide leg trousers, open toe heeled sandals, square black sunglasses, plain white studio background',
    ],
  },
  'fourrure_longue': {
    label: 'Fourrure longue',
    accessories: [
      'wearing sheer black tights, high heels, square black sunglasses, fur chapka hat, plain white studio background',
    ],
  },
  'fourrure_courte': {
    label: 'Fourrure courte',
    accessories: [
      'wearing leather pants, pointed toe shoes, fur chapka hat, plain white studio background',
    ],
  },

  // ── VESTES ──
  'veste': {
    label: 'Veste',
    accessories: [
      'wearing wide leg trousers, open toe heeled sandals, square black sunglasses, plain white studio background',
      'wearing a midi skirt, strappy sandals, square black sunglasses, plain white studio background',
    ],
  },
  'veste_cuir': {
    label: 'Veste en cuir',
    accessories: [
      'wearing square black sunglasses, open toe heeled sandals, plain white studio background',
      'wearing square black sunglasses, strappy sandals, plain white studio background',
    ],
  },
  'blazer': {
    label: 'Blazer',
    accessories: [
      'wearing nothing underneath, wide leg cropped trousers, open toe heeled mules, square black sunglasses, plain white studio background',
      'wearing a silk camisole underneath, wide leg cropped trousers, strappy sandals, square black sunglasses, plain white studio background',
    ],
  },
  'perfecto': {
    label: 'Perfecto',
    accessories: [
      'wearing oversized, wide leg trousers, open toe heeled sandals, square black sunglasses, plain white studio background',
    ],
  },
  'veste_racing': {
    label: 'Veste Racing',
    accessories: [
      'wearing oversized, wide leg trousers, open toe heeled sandals, square black sunglasses, plain white studio background',
    ],
  },
  'veste / manteau': {
    label: 'Veste / Manteau',
    accessories: [
      'wearing wide leg trousers, open toe heeled sandals, square black sunglasses, plain white studio background',
      'wearing a midi skirt, strappy sandals, square black sunglasses, plain white studio background',
    ],
  },

  // ── ROBES ──
  'robe': {
    label: 'Robe',
    accessories: [
      'wearing strappy heeled sandals, bare legs, square black sunglasses, plain white studio background',
      'wearing open toe heeled mules, bare legs, silk scarf in hair, plain white studio background',
    ],
  },

  // ── JUPES / SHORTS ──
  'jupe': {
    label: 'Jupe',
    accessories: [
      'wearing a white tank top, bare legs, strappy heeled sandals, square black sunglasses, plain white studio background',
      'wearing a silk camisole, bare legs, open toe heeled mules, silk scarf in hair, plain white studio background',
    ],
  },
  'jupe / short': {
    label: 'Jupe / Short',
    accessories: [
      'wearing a white tank top, bare legs, strappy heeled sandals, square black sunglasses, plain white studio background',
      'wearing a silk camisole, bare legs, open toe heeled mules, silk scarf in hair, plain white studio background',
    ],
  },
  'short': {
    label: 'Short',
    accessories: [
      'wearing a white tank top, bare legs, strappy heeled sandals, square black sunglasses, plain white studio background',
      'wearing a silk camisole, bare legs, open toe heeled mules, square black sunglasses, plain white studio background',
    ],
  },

  // ── PANTALONS ──
  'pantalon': {
    label: 'Pantalon',
    accessories: [
      'wearing open toe heeled sandals, silk camisole, square black sunglasses, plain white studio background',
      'wearing strappy sandals, tank top, silk scarf in hair, plain white studio background',
    ],
  },

  // ── COMBINAISONS ──
  'combinaison': {
    label: 'Combinaison',
    accessories: [
      'wearing square black sunglasses, open toe heeled sandals, plain white studio background',
      'wearing square black sunglasses, strappy sandals, silk scarf in hair, plain white studio background',
    ],
  },

  // ── ENSEMBLES ──
  'ensemble': {
    label: 'Ensemble',
    accessories: [
      'wearing square black sunglasses, open toe heeled sandals, plain white studio background',
      'wearing square black sunglasses, strappy sandals, plain white studio background',
    ],
  },
}

const DEFAULT_OUTFIT: OutfitConfig = {
  label: 'Défaut',
  accessories: [
    'wearing elegant wide leg trousers and strappy sandals, square black sunglasses, plain white studio background',
  ],
}

export function getOutfitPrompt(
  categorie: string,
  opts?: { nom?: string; matiere?: string }
): string {
  const cat = categorie.toLowerCase().trim()
  const nom = (opts?.nom || '').toLowerCase()
  const matiere = (opts?.matiere || '').toLowerCase()

  const isFourrure = nom.includes('fourrure') || matiere.includes('fourrure')
  const isCuir = nom.includes('cuir') || matiere.includes('cuir')

  if (isFourrure && (cat.includes('manteau') || cat.includes('veste / manteau'))) {
    return withGlasses(pickRandom(OUTFITS['fourrure_longue'].accessories))
  }
  if (isFourrure && cat.includes('veste')) {
    return withGlasses(pickRandom(OUTFITS['fourrure_courte'].accessories))
  }
  if (isCuir && (cat.includes('manteau') || cat.includes('veste / manteau'))) {
    return withGlasses(pickRandom([
      'wearing wide leg trousers, open toe heeled sandals, square black sunglasses, plain white studio background',
    ]))
  }
  if (isCuir && cat.includes('veste')) {
    return withGlasses(pickRandom(OUTFITS['veste_cuir'].accessories))
  }
  const isBlazer = nom.includes('blazer')
  if (isBlazer) {
    return withGlasses(pickRandom(OUTFITS['blazer'].accessories))
  }
  const isPerfecto = nom.includes('perfecto')
  if (isPerfecto) {
    return withGlasses(pickRandom(OUTFITS['perfecto'].accessories))
  }
  const isRacing = nom.includes('racing')
  if (isRacing) {
    return withGlasses(pickRandom(OUTFITS['veste_racing'].accessories))
  }
  if (cat.includes('jupe') || cat.includes('short')) {
    return withGlasses(pickRandom(OUTFITS['jupe'].accessories))
  }
  if (OUTFITS[cat]) {
    return withGlasses(pickRandom(OUTFITS[cat].accessories))
  }
  for (const [key, config] of Object.entries(OUTFITS)) {
    if (!key.includes('_') && cat.includes(key)) {
      return withGlasses(pickRandom(config.accessories))
    }
  }
  return withGlasses(pickRandom(DEFAULT_OUTFIT.accessories))
}

export function getAllOutfitCategories(): { key: string; label: string }[] {
  return Object.entries(OUTFITS).map(([key, config]) => ({
    key,
    label: config.label,
  }))
}