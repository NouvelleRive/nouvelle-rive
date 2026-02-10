// lib/marques.ts
// Liste des marques connues pour auto-détection depuis le titre produit

export const MARQUES: string[] = [
  // Luxe français
  'Chanel', 'Dior', 'Christian Dior', 'Louis Vuitton', 'Hermès', 'Hermes', 'Hemès',
  'Yves Saint Laurent', 'YSL', 'Saint Laurent', 'Celine', 'Céline',
  'Givenchy', 'Lanvin', 'Balmain', 'Balenciaga', 'Courrèges', 'Courreges',
  'Jean Paul Gaultier', 'JPG', 'Chloé', 'Chloe', 'Sonia Rykiel', 'Kenzo',
  'Thierry Mugler', 'Mugler', 'Pierre Cardin', 'Ungaro', 'Emanuel Ungaro',
  'Nina Ricci', 'Rochas', 'Jacquemus', 'Lemaire', 'Isabel Marant',
  'Agnès b', 'Agnes b', 'Zadig & Voltaire', 'Sézane', 'Claudie Pierlot',
  'Maje', 'Sandro', 'Bash', 'Ba&sh', 'Tara Jarmon', 'Vanessa Bruno',

  // Luxe italien
  'Gucci', 'Prada', 'Versace', 'Valentino', 'Fendi', 'Bottega Veneta',
  'Dolce & Gabbana', 'D&G', 'Armani', 'Giorgio Armani', 'Emporio Armani',
  'Roberto Cavalli', 'Cavalli', 'Missoni', 'Moschino', 'Miu Miu',
  'Salvatore Ferragamo', 'Ferragamo', 'Tod\'s', 'Max Mara', 'Marni',
  'Etro', 'Emilio Pucci', 'Pucci', 'Loro Piana',

  // Luxe britannique
  'Burberry', 'Burberrys', 'Alexander McQueen', 'McQueen', 'Vivienne Westwood',
  'Stella McCartney', 'Paul Smith', 'Mulberry', 'Jimmy Choo',

  // Luxe japonais
  'Comme des Garçons', 'CDG', 'Yohji Yamamoto', 'Yamamoto', 'Issey Miyake',
  'Kansai Yamamoto', 'Sacai', 'Undercover',

  // Créateurs belges
  'Dries Van Noten', 'Van Noten', 'Martin Margiela', 'Margiela', 'Maison Margiela',
  'Ann Demeulemeester', 'Raf Simons',

  // Sportswear / Streetwear
  'Y-3', 'Y3', 'Adidas', 'Nike', 'Lacoste', 'Ralph Lauren', 'Polo Ralph Lauren',
  'Tommy Hilfiger', 'Calvin Klein', 'CK', 'The North Face', 'Carhartt',
  'Stüssy', 'Stussy', 'Supreme',

  // Vintage / Casual
  'Chevignon', 'Plein Sud', 'Marithé + François Girbaud', 'Girbaud',
  'Thierry Mugler', 'Claude Montana', 'Montana', 'Azzedine Alaïa', 'Alaïa', 'Alaia',
  'Loewe', 'Escada', 'Gérard Darel', 'Gerard Darel',
  'Céline', 'Celine', 'Longchamp', 'Cartier', 'Van Cleef',

  // Accessoires / Bijoux
  'Tiffany', 'Bulgari', 'Chopard', 'Swarovski',
]

// Map pour normaliser les variantes vers le nom canonique
const ALIASES: Record<string, string> = {
  'ysl': 'Yves Saint Laurent',
  'saint laurent': 'Yves Saint Laurent',
  'christian dior': 'Dior',
  'hemès': 'Hermès',
  'hermes': 'Hermès',
  'burberrys': 'Burberry',
  'mcqueen': 'Alexander McQueen',
  'alexander mcqueen': 'Alexander McQueen',
  'van noten': 'Dries Van Noten',
  'dries van noten': 'Dries Van Noten',
  'margiela': 'Maison Margiela',
  'martin margiela': 'Maison Margiela',
  'maison margiela': 'Maison Margiela',
  'cdg': 'Comme des Garçons',
  'comme des garçons': 'Comme des Garçons',
  'yamamoto': 'Yohji Yamamoto',
  'cavalli': 'Roberto Cavalli',
  'roberto cavalli': 'Roberto Cavalli',
  'ferragamo': 'Salvatore Ferragamo',
  'salvatore ferragamo': 'Salvatore Ferragamo',
  'd&g': 'Dolce & Gabbana',
  'dolce & gabbana': 'Dolce & Gabbana',
  'pucci': 'Emilio Pucci',
  'emilio pucci': 'Emilio Pucci',
  'jpg': 'Jean Paul Gaultier',
  'jean paul gaultier': 'Jean Paul Gaultier',
  'mugler': 'Thierry Mugler',
  'thierry mugler': 'Thierry Mugler',
  'celine': 'Céline',
  'céline': 'Céline',
  'chloe': 'Chloé',
  'chloé': 'Chloé',
  'courreges': 'Courrèges',
  'courrèges': 'Courrèges',
  'alaïa': 'Azzedine Alaïa',
  'alaia': 'Azzedine Alaïa',
  'azzedine alaïa': 'Azzedine Alaïa',
  'montana': 'Claude Montana',
  'claude montana': 'Claude Montana',
  'y3': 'Y-3',
  'y-3': 'Y-3',
  'ck': 'Calvin Klein',
  'girbaud': 'Marithé + François Girbaud',
  'ba&sh': 'Ba&sh',
  'bash': 'Ba&sh',
  'agnes b': 'Agnès b',
  'agnès b': 'Agnès b',
  'stussy': 'Stüssy',
  'stüssy': 'Stüssy',
  'giorgio armani': 'Armani',
  'emporio armani': 'Armani',
  'polo ralph lauren': 'Ralph Lauren',
  'ungaro': 'Emanuel Ungaro',
  'emanuel ungaro': 'Emanuel Ungaro',
  'louis vuitton': 'Louis Vuitton',
  'lanvin': 'Lanvin',
}

// Trier par longueur décroissante pour matcher les noms composés d'abord
const SORTED_BRANDS = [...new Set([
  ...MARQUES,
  ...Object.keys(ALIASES),
])].sort((a, b) => b.length - a.length)

/**
 * Détecte la marque dans un titre de produit
 * Retourne le nom canonique ou null
 */
export function detectMarque(titre: string): string | null {
  const t = titre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  for (const brand of SORTED_BRANDS) {
    const b = brand.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Match mot entier (pas "Dior" dans "ordinateur")
    const regex = new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (regex.test(t)) {
      // Retourner le nom canonique
      const canonical = ALIASES[brand.toLowerCase()] || brand
      // Trouver la version avec la bonne casse dans MARQUES
      const found = MARQUES.find(m => m.toLowerCase() === canonical.toLowerCase())
      return found || canonical
    }
  }

  return null
}