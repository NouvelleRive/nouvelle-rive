// Traductions EN des accroches/descriptions des créatrices.
// Clé = slug du document `chineuse` (ou nom normalisé).
// Si un doc Firestore contient déjà `accrocheEn`/`descriptionEn`, ils ont priorité sur cette table.

export type CreatriceI18n = {
  accrocheEn?: string
  descriptionEn?: string
}

// Normalise un nom de créatrice pour matcher la clé
// (lowercase + sans accents + sans espaces/apostrophes/tirets)
export function normalizeCreatriceKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’\-_.\s]+/g, '')
}

// Lookup : on accepte slug OU nom normalisé
export const CREATRICES_EN: Record<string, CreatriceI18n> = {
  // === ÂGE Paris ===
  ageparis: {
    descriptionEn:
      "Founded in 2021 by Eva and Mégane — best friends — ÂGE Paris embodies the renewal of the textile industry at its finest. Their flagship piece, the iconic suit, is being reinvented: now upcycled from sourced finds or deadstock rolls from Luxury Houses. Collections are designed and produced in their Paris ateliers by tailors and seamstresses who have worked for houses such as Christian Dior or Emmanuelle Khanh. The name “ÂGE” evokes the timeless beauty and rich history of vintage clothing.",
  },
  age: {
    descriptionEn:
      "Founded in 2021 by Eva and Mégane — best friends — ÂGE Paris embodies the renewal of the textile industry at its finest. Their flagship piece, the iconic suit, is being reinvented: now upcycled from sourced finds or deadstock rolls from Luxury Houses. Collections are designed and produced in their Paris ateliers by tailors and seamstresses who have worked for houses such as Christian Dior or Emmanuelle Khanh. The name “ÂGE” evokes the timeless beauty and rich history of vintage clothing.",
  },

  // === Adrénaline ===
  adrenaline: {
    descriptionEn:
      "Adrénaline is a Parisian upcycled jewelry brand, born from the transformation of antique objects sourced through curated finds. Each creation is one of a kind — singular and carrying its own story — conceived as a contemporary talisman. The brand embraces a free, raw and poetic aesthetic.",
  },
}

export function getCreatriceI18n(
  slug: string | undefined,
  nom: string | undefined
): CreatriceI18n | null {
  const candidates = [slug, nom].filter(Boolean) as string[]
  for (const c of candidates) {
    const direct = CREATRICES_EN[c]
    if (direct) return direct
    const norm = CREATRICES_EN[normalizeCreatriceKey(c)]
    if (norm) return norm
  }
  return null
}
