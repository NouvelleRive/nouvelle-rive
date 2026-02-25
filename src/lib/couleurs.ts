// lib/couleurs.ts

export type ColorItem = {
  name: string
  hex: string
  prio?: ('vetements' | 'bijoux' | 'sacs' | 'chaussures')[]
}

export const COLOR_PALETTE: ColorItem[] = [
  // === Neutres & basiques (prio vêtements + sacs + chaussures) ===
  { name: 'Noir', hex: '#1A1A1A', prio: ['vetements', 'sacs', 'chaussures'] },
  { name: 'Blanc', hex: '#FFFFFF', prio: ['vetements'] },
  { name: 'Écru', hex: '#F5F5DC', prio: ['vetements'] },
  { name: 'Crème', hex: '#FFFDD0', prio: ['vetements'] },
  { name: 'Ivoire', hex: '#FFFFF0', prio: ['vetements'] },
  { name: 'Beige', hex: '#D4B896', prio: ['vetements', 'sacs'] },
  { name: 'Nude', hex: '#E3BC9A', prio: ['vetements', 'chaussures'] },
  { name: 'Sable', hex: '#C2B280', prio: ['vetements'] },
  { name: 'Camel', hex: '#C19A6B', prio: ['vetements', 'sacs', 'chaussures'] },
  { name: 'Cognac', hex: '#9A463D', prio: ['sacs', 'chaussures'] },
  { name: 'Fauve', hex: '#C8A951', prio: ['sacs', 'chaussures'] },
  { name: 'Marron', hex: '#5C4033', prio: ['vetements', 'sacs', 'chaussures'] },
  { name: 'Taupe', hex: '#8B7D6B', prio: ['vetements', 'sacs', 'chaussures'] },
  { name: 'Gris', hex: '#808080', prio: ['vetements'] },
  { name: 'Anthracite', hex: '#3D3D3D', prio: ['vetements'] },

  // === Rouges & roses ===
  { name: 'Rouge', hex: '#C41E3A', prio: ['vetements', 'sacs'] },
  { name: 'Bordeaux', hex: '#6B1C23', prio: ['vetements', 'sacs'] },
  { name: 'Brique', hex: '#CB4154' },
  { name: 'Rouille', hex: '#B7410E' },
  { name: 'Terracotta', hex: '#CC4E3A' },
  { name: 'Corail', hex: '#FF7F50' },
  { name: 'Rose', hex: '#E8B4B8', prio: ['vetements'] },
  { name: 'Fuchsia', hex: '#FF00FF' },

  // === Oranges & jaunes ===
  { name: 'Orange', hex: '#E86100' },
  { name: 'Jaune', hex: '#E8C547' },
  { name: 'Champagne', hex: '#F7E7CE' },

  // === Verts ===
  { name: 'Vert', hex: '#228B22', prio: ['vetements'] },
  { name: 'Kaki', hex: '#6B6B47', prio: ['vetements'] },
  { name: 'Olive', hex: '#556B2F' },

  // === Bleus ===
  { name: 'Bleu marine', hex: '#1E3A5F', prio: ['vetements'] },
  { name: 'Bleu', hex: '#2563EB' },
  { name: 'Bleu ciel', hex: '#87CEEB' },
  { name: 'Turquoise', hex: '#40E0D0' },

  // === Violets ===
  { name: 'Violet', hex: '#6B3FA0' },
  { name: 'Mauve', hex: '#9B7DB8' },
  { name: 'Lilas', hex: '#C8A2C8' },
  { name: 'Lavande', hex: '#B57EDC' },
  { name: 'Prune', hex: '#701C45' },
  { name: 'Aubergine', hex: '#3D0C45' },

  // === Métalliques (prio bijoux) ===
  { name: 'Doré', hex: '#C5A048', prio: ['bijoux', 'sacs'] },
  { name: 'Argenté', hex: '#A8A8A8', prio: ['bijoux'] },
  { name: 'Bronze', hex: '#CD7F32', prio: ['bijoux'] },
  { name: 'Cuivre', hex: '#B87333', prio: ['bijoux'] },

  // === Multi ===
  { name: 'Multicolore', hex: 'linear-gradient(135deg, #FF6B6B, #4ECDC4, #FFE66D, #A06CD5)' },
]

/**
 * Retourne les couleurs triées par priorité selon la catégorie
 * Les couleurs prioritaires apparaissent en premier
 */
export type CouleurCategorie = 'vetements' | 'bijoux' | 'sacs' | 'chaussures'

export function detectCouleurCategorie(categorie: string): CouleurCategorie {
  const cat = categorie.toLowerCase()
  if (['sac', 'pochette', 'besace', 'cabas'].some(c => cat.includes(c))) return 'sacs'
  if (['bijoux', 'bijou', 'bague', 'collier', 'bracelet', 'broche', 'boucle', 'charms', 'earcuff', 'piercing'].some(c => cat.includes(c))) return 'bijoux'
  if (['chaussures', 'botte', 'bottine', 'escarpin', 'sandale', 'mocassin', 'basket', 'sneaker'].some(c => cat.includes(c))) return 'chaussures'
  return 'vetements'
}

export function getColorsPrioritized(categorie: string): { priority: ColorItem[], others: ColorItem[] } {
  const type = detectCouleurCategorie(categorie)
  const priority: ColorItem[] = []
  const others: ColorItem[] = []

  for (const color of COLOR_PALETTE) {
    if (color.prio?.includes(type)) {
      priority.push(color)
    } else {
      others.push(color)
    }
  }

  return { priority, others }
}