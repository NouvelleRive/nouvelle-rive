type BagSizeEntry = {
  name: string
  length: number // cm
  width: number  // cm (hauteur)
}

type BagModelSizes = {
  model: string
  sizes: BagSizeEntry[]
}

// Marge de tolérance en cm
const MARGIN = 2

export const BAG_CATALOG: Record<string, BagModelSizes[]> = {
  'Louis Vuitton': [
    { model: 'Speedy', sizes: [
      { name: '25', length: 25, width: 19 },
      { name: '30', length: 30, width: 21 },
      { name: '35', length: 35, width: 23 },
      { name: '40', length: 40, width: 25 },
    ]},
    { model: 'Neverfull', sizes: [
      { name: 'PM', length: 29, width: 21 },
      { name: 'MM', length: 31, width: 28 },
      { name: 'GM', length: 39, width: 32 },
    ]},
    { model: 'Alma', sizes: [
      { name: 'BB', length: 24, width: 18 },
      { name: 'PM', length: 32, width: 25 },
      { name: 'GM', length: 39, width: 29 },
    ]},
    { model: 'Pochette Métis', sizes: [
      { name: 'PM', length: 25, width: 19 },
      { name: 'MM', length: 30, width: 22 },
    ]},
    { model: 'Capucines', sizes: [
      { name: 'BB', length: 27, width: 18 },
      { name: 'MM', length: 31, width: 20 },
      { name: 'GM', length: 36, width: 23 },
    ]},
  ],
  'Chanel': [
    { model: 'Classic Flap', sizes: [
      { name: 'Mini', length: 20, width: 12 },
      { name: 'Small', length: 23, width: 14 },
      { name: 'Medium', length: 26, width: 15 },
      { name: 'Jumbo', length: 30, width: 20 },
      { name: 'Maxi', length: 33, width: 23 },
    ]},
    { model: 'Boy', sizes: [
      { name: 'Small', length: 20, width: 12 },
      { name: 'Medium', length: 25, width: 15 },
      { name: 'Large', length: 28, width: 17 },
    ]},
    { model: '2.55', sizes: [
      { name: '224', length: 16, width: 11 },
      { name: '225', length: 22, width: 14 },
      { name: '226', length: 26, width: 16 },
      { name: '227', length: 30, width: 19 },
      { name: '228', length: 33, width: 22 },
    ]},
    { model: 'GST', sizes: [
      { name: 'Standard', length: 34, width: 24 },
    ]},
    { model: 'WOC', sizes: [
      { name: 'Standard', length: 19, width: 12 },
    ]},
  ],
  'Hermès': [
    { model: 'Birkin', sizes: [
      { name: '25', length: 25, width: 20 },
      { name: '30', length: 30, width: 22 },
      { name: '35', length: 35, width: 25 },
      { name: '40', length: 40, width: 30 },
    ]},
    { model: 'Kelly', sizes: [
      { name: '25', length: 25, width: 17 },
      { name: '28', length: 28, width: 22 },
      { name: '32', length: 32, width: 23 },
      { name: '35', length: 35, width: 25 },
    ]},
    { model: 'Constance', sizes: [
      { name: 'Mini', length: 18, width: 15 },
      { name: '24', length: 24, width: 18 },
    ]},
    { model: 'Evelyne', sizes: [
      { name: 'TPM', length: 16, width: 18 },
      { name: 'PM', length: 29, width: 30 },
      { name: 'GM', length: 33, width: 31 },
    ]},
    { model: 'Garden Party', sizes: [
      { name: '30', length: 30, width: 21 },
      { name: '36', length: 36, width: 24 },
    ]},
  ],
  'Dior': [
    { model: 'Lady Dior', sizes: [
      { name: 'Mini', length: 17, width: 15 },
      { name: 'Small', length: 20, width: 17 },
      { name: 'Medium', length: 24, width: 20 },
      { name: 'Large', length: 32, width: 25 },
    ]},
    { model: 'Saddle', sizes: [
      { name: 'Mini', length: 18, width: 15 },
      { name: 'Medium', length: 26, width: 19 },
    ]},
    { model: 'Book Tote', sizes: [
      { name: 'Mini', length: 23, width: 17 },
      { name: 'Small', length: 36, width: 28 },
      { name: 'Medium', length: 36, width: 28 },
      { name: 'Large', length: 42, width: 35 },
    ]},
  ],
  'Celine': [
    { model: 'Luggage', sizes: [
      { name: 'Nano', length: 20, width: 20 },
      { name: 'Micro', length: 26, width: 26 },
      { name: 'Mini', length: 30, width: 30 },
    ]},
    { model: 'Classic Box', sizes: [
      { name: 'Teen', length: 18, width: 14 },
      { name: 'Medium', length: 24, width: 18 },
    ]},
    { model: 'Belt Bag', sizes: [
      { name: 'Pico', length: 17, width: 12 },
      { name: 'Nano', length: 20, width: 20 },
      { name: 'Mini', length: 24, width: 24 },
      { name: 'Micro', length: 27, width: 27 },
    ]},
  ],
  'Saint Laurent': [
    { model: 'Sac de Jour', sizes: [
      { name: 'Nano', length: 22, width: 17 },
      { name: 'Baby', length: 32, width: 25 },
      { name: 'Small', length: 36, width: 27 },
    ]},
    { model: 'Loulou', sizes: [
      { name: 'Toy', length: 20, width: 14 },
      { name: 'Small', length: 25, width: 17 },
      { name: 'Medium', length: 32, width: 22 },
    ]},
    { model: 'Kate', sizes: [
      { name: 'Medium', length: 24, width: 15 },
    ]},
  ],
  'Gucci': [
    { model: 'Marmont', sizes: [
      { name: 'Mini', length: 22, width: 13 },
      { name: 'Small', length: 26, width: 15 },
      { name: 'Medium', length: 31, width: 19 },
    ]},
    { model: 'Dionysus', sizes: [
      { name: 'Mini', length: 20, width: 16 },
      { name: 'Small', length: 25, width: 14 },
      { name: 'Medium', length: 28, width: 18 },
    ]},
    { model: 'Jackie', sizes: [
      { name: 'Mini', length: 19, width: 13 },
      { name: 'Small', length: 28, width: 19 },
    ]},
  ],
  'Fendi': [
    { model: 'Baguette', sizes: [
      { name: 'Mini', length: 18, width: 12 },
      { name: 'Medium', length: 26, width: 15 },
      { name: 'Large', length: 33, width: 18 },
    ]},
    { model: 'Peekaboo', sizes: [
      { name: 'Mini', length: 23, width: 18 },
      { name: 'Regular', length: 33, width: 25 },
      { name: 'Large', length: 40, width: 29 },
    ]},
  ],
  'Prada': [
    { model: 'Galleria', sizes: [
      { name: 'Mini', length: 22, width: 17 },
      { name: 'Small', length: 28, width: 20 },
      { name: 'Medium', length: 33, width: 25 },
      { name: 'Large', length: 37, width: 27 },
    ]},
    { model: 'Re-Edition', sizes: [
      { name: '2000', length: 22, width: 15 },
      { name: '2005', length: 22, width: 18 },
    ]},
  ],
  'Balenciaga': [
    { model: 'City', sizes: [
      { name: 'Mini', length: 24, width: 16 },
      { name: 'Small', length: 30, width: 19 },
      { name: 'Medium', length: 38, width: 24 },
      { name: 'Large', length: 43, width: 30 },
    ]},
    { model: 'Hourglass', sizes: [
      { name: 'XS', length: 19, width: 12 },
      { name: 'Small', length: 23, width: 16 },
    ]},
  ],
  'Bottega Veneta': [
    { model: 'Cassette', sizes: [
      { name: 'Mini', length: 18, width: 12 },
      { name: 'Medium', length: 23, width: 15 },
    ]},
    { model: 'Pouch', sizes: [
      { name: 'Mini', length: 22, width: 13 },
      { name: 'Medium', length: 32, width: 17 },
      { name: 'Large', length: 40, width: 22 },
    ]},
  ],
  'Loewe': [
    { model: 'Puzzle', sizes: [
      { name: 'Mini', length: 18, width: 12 },
      { name: 'Small', length: 24, width: 15 },
      { name: 'Medium', length: 29, width: 19 },
    ]},
    { model: 'Hammock', sizes: [
      { name: 'Mini', length: 21, width: 17 },
      { name: 'Small', length: 29, width: 25 },
    ]},
  ],
}

/**
 * Détecte le nom de taille d'un sac à partir des dimensions mesurées
 * Retourne le nom + modèle si trouvé, null sinon
 */
export function detectBagSizeName(
  marque: string,
  modele: string,
  longueur: number,
  largeur: number
): { sizeName: string; model: string } | null {
  if (!marque || !longueur || !largeur) return null

  // Trouver la marque
  const brandKey = Object.keys(BAG_CATALOG).find(
    b => marque.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(marque.toLowerCase())
  )
  if (!brandKey) return null

  const models = BAG_CATALOG[brandKey]

  // Si modèle spécifié, chercher dedans d'abord
  if (modele) {
    const modelMatch = models.find(
      m => m.model.toLowerCase() === modele.toLowerCase()
        || modele.toLowerCase().includes(m.model.toLowerCase())
        || m.model.toLowerCase().includes(modele.toLowerCase())
    )
    if (modelMatch) {
      const sizeMatch = modelMatch.sizes.find(
        s => Math.abs(s.length - longueur) <= MARGIN && Math.abs(s.width - largeur) <= MARGIN
      )
      if (sizeMatch) return { sizeName: sizeMatch.name, model: modelMatch.model }
    }
  }

  // Sinon chercher dans tous les modèles de la marque
  for (const m of models) {
    const sizeMatch = m.sizes.find(
      s => Math.abs(s.length - longueur) <= MARGIN && Math.abs(s.width - largeur) <= MARGIN
    )
    if (sizeMatch) return { sizeName: sizeMatch.name, model: m.model }
  }

  return null
}

/**
 * Retourne les modèles de sacs pour une marque donnée
 */
export function getBagModelsForBrand(marque: string): string[] {
  if (!marque) return []
  const brandKey = Object.keys(BAG_CATALOG).find(
    b => marque.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(marque.toLowerCase())
  )
  if (!brandKey) return []
  return BAG_CATALOG[brandKey].map(m => m.model)
}