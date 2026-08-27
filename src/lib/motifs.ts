// lib/motifs.ts
// Liste canonique des motifs proposés à la saisie produit (champ « Motif »).
// Même logique que la palette de couleurs (src/lib/couleurs.ts) : source unique,
// réutilisable. Les traductions EN vivent dans src/lib/i18n.ts (MOTIF_EN),
// comme pour les couleurs/matières.

export const MOTIF_OPTIONS: string[] = [
  'Floral',
  'Léopard',
  'Zèbre',
  'Rayures',
  'Carreaux',
  'Polka dot',
  'Vichy',
  'Tartan',
  'Madras',
  'Liberty',
  'Tropical',
  'Python',
  'Croco',
  'Abstrait',
  'Bandana',
  'Ethnique',
]

// Synonymes → motif canonique. Clés sans accents/minuscules (le detecteur
// normalise le nom avant de comparer). « fleur / fleurs / fleuri » → Floral, etc.
const MOTIF_SYNONYMES: Record<string, string[]> = {
  'Floral': ['floral', 'florale', 'fleur', 'fleurs', 'fleuri', 'fleurie'],
  'Léopard': ['leopard', 'guepard'],
  'Zèbre': ['zebre', 'zebra'],
  'Rayures': ['rayure', 'rayures', 'raye', 'rayee', 'rayures', 'stripe', 'stripes', 'mariniere'],
  'Carreaux': ['carreau', 'carreaux', 'carreaute', 'check', 'gingham'],
  'Polka dot': ['pois', 'polka', 'polka dot', 'dots'],
  'Vichy': ['vichy'],
  'Tartan': ['tartan', 'ecossais', 'ecossaise', 'plaid'],
  'Madras': ['madras'],
  'Liberty': ['liberty'],
  'Tropical': ['tropical', 'tropicale', 'palmier', 'palmiers', 'hawaien', 'hawaienne', 'jungle'],
  'Python': ['python', 'serpent', 'snake'],
  'Croco': ['croco', 'crocodile', 'alligator'],
  'Abstrait': ['abstrait', 'abstraite', 'abstract'],
  'Bandana': ['bandana', 'paisley', 'cachemire'],
  'Ethnique': ['ethnique', 'azteque', 'aztec', 'ikat', 'wax'],
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Détecte un motif dans un titre/nom de produit (renvoie le motif canonique ou
 * null). « robe à fleurs » → « Floral ». Insensible casse/accents, par mot.
 */
export function detectMotif(titre: string): string | null {
  if (!titre) return null
  const t = normalize(titre)
  for (const [canon, syns] of Object.entries(MOTIF_SYNONYMES)) {
    for (const syn of syns) {
      const escaped = syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(t)) return canon
    }
  }
  return null
}
