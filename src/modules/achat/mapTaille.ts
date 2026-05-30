// Mapping d'une taille Vinted (ou autre plateforme) vers les valeurs canoniques
// NR. Crucial pour ne pas polluer les filtres de recherche avec des valeurs
// type "S / 36 / 8" qui ne matchent rien côté NR.
//
// Conventions NR (cf. src/lib/tailles.ts) :
//   - Adulte   : XXS XS S M L XL XXL XXXL
//   - Chaussures : 35 36 37 ... 46
//   - Bagues   : 48 49 ... 66 + Taille unique
//
// Stratégie : on prend le 1er segment "logique" du libellé Vinted et on le
// normalise. Si ça ne mappe à rien d'identifiable, on retourne chaîne vide
// (l'admin remplit à la main).

const ADULTE_VALIDES = new Set(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'])

/**
 * Mappe une taille brute (style Vinted "S / 36 / 8", "M", "W27", "T36") vers
 * une valeur canonique NR. Retourne '' si rien ne matche.
 */
export function mapTailleVintedVersNR(raw: string): string {
  if (!raw) return ''
  const s = raw.trim()

  // Cas "S / 36 / 8" → 3 segments, on prend le premier (lettre)
  const segments = s.split(/\s*[\/|]\s*/)
  if (segments.length > 1) {
    // 1er segment = label adulte (XS/S/M...) si présent
    const first = segments[0].toUpperCase().trim()
    if (ADULTE_VALIDES.has(first)) return first
    // sinon 2e segment = taille FR (36, 38, 40...) si numérique
    const second = segments[1].trim()
    if (/^\d{2,3}$/.test(second)) {
      const mapped = mapFrSize(parseInt(second, 10))
      if (mapped) return mapped
    }
  }

  // Cas direct "S", "M", "L" etc.
  const up = s.toUpperCase().trim()
  if (ADULTE_VALIDES.has(up)) return up

  // Cas "T36", "T38" etc.
  const tMatch = up.match(/^T?\s*(\d{2,3})$/)
  if (tMatch) {
    const fr = parseInt(tMatch[1], 10)
    const mapped = mapFrSize(fr)
    if (mapped) return mapped
    if (fr >= 35 && fr <= 46) return String(fr) // taille chaussure
  }

  // Cas "W27", "W28" (jean waist) — pas de mapping clair vers NR, on laisse vide
  // pour éviter de polluer les filtres. L'admin met "S/M/L" à la main.
  if (/^W\d{2}$/i.test(s)) return ''

  return ''
}

/** Convertit une taille FR adulte (32, 34, 36, 38, 40, 42, 44, 46, 48) en label NR. */
function mapFrSize(fr: number): string | null {
  if (fr <= 32) return 'XXS'
  if (fr === 34) return 'XS'
  if (fr === 36) return 'S'
  if (fr === 38) return 'M'
  if (fr === 40) return 'L'
  if (fr === 42) return 'XL'
  if (fr === 44) return 'XXL'
  if (fr >= 46) return 'XXXL'
  return null
}
