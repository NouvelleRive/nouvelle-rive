// Parser du contenu copié-collé d'une page d'annonce Vinted.
//
// Contrairement au mail "Ton reçu" qui ne donne presque rien, la page Vinted
// elle-même contient titre, marque, taille, couleur, état, description, prix
// article, prix total avec frais protection, et pseudo vendeur. On extrait
// tout ce qui est lisible depuis un Cmd+A → Copier sur l'onglet de l'annonce.
//
// Les photos ne sont PAS dans un copier-coller texte (le navigateur ne copie
// que le texte), elles devront être uploadées séparément.

export type VintedPageParsed = {
  ok: true
  provenance: 'vinted-page'
  /** Titre brut de l'annonce (ex: "Top ibiza") */
  titre: string
  /** Marque indiquée (peut être "Inconnu") */
  marque: string
  /** Taille brute (ex: "S / 36 / 8") */
  taille: string
  /** Couleur (ex: "Bleu") */
  couleur: string
  /** État (ex: "Très bon état", "Neuf sans étiquette") */
  etat: string
  /** Description libre laissée par le vendeur */
  description: string
  /** Pseudo vendeur (ex: "lisa_g41") */
  vendeur: string
  /** Prix de l'article seul, en € (sans frais protection ni port) */
  prixArticle: number | null
  /** Prix total avec protection acheteurs, en € (souvent affiché sous le prix article) */
  prixAvecProtection: number | null
  /** ID numérique de l'annonce Vinted, extrait de l'URL si présente */
  itemId: string | null
  /** URL de l'annonce si présente dans le texte collé */
  url: string | null
}

export type VintedPageResult = VintedPageParsed | { ok: false; reason: string }

/**
 * Parse le contenu d'une page d'annonce Vinted (texte brut copié-collé).
 * On considère qu'il s'agit d'une page Vinted si on trouve l'URL `vinted.fr/items/`
 * OU plusieurs labels caractéristiques de la page produit (Marque/Taille/État).
 */
export function parseVintedPage(rawText: string): VintedPageResult {
  const text = normalize(rawText)
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  const url = extractFirst(text, /https?:\/\/www\.vinted\.fr\/items\/[^\s]+/i)
  const itemIdMatch = url?.match(/\/items\/(\d+)/)
  const itemId = itemIdMatch ? itemIdMatch[1] : null

  // On exige le contenu de la page complète : la présence d'au moins 2 des 4
  // labels caractéristiques (Marque / Taille / État / Couleur) ou la marker
  // "Inclut la Protection acheteurs" garantit qu'on a bien la page collée et
  // pas juste une URL ou un fragment.
  const labelsPresent = [
    matchLabel(lines, 'Marque'),
    matchLabel(lines, 'Taille'),
    matchLabel(lines, 'État') || matchLabel(lines, 'Etat'),
    matchLabel(lines, 'Couleur'),
  ].filter(Boolean).length
  const looksLikePage =
    /Inclut la Protection acheteurs/i.test(text) ||
    labelsPresent >= 2
  if (!looksLikePage) {
    return {
      ok: false,
      reason: 'Contenu insuffisant. Colle la page Vinted complète (Cmd+A sur l\'annonce, pas juste le lien).',
    }
  }

  const marque = matchLabel(lines, 'Marque') || ''
  const taille = matchLabel(lines, 'Taille') || ''
  const etat = matchLabel(lines, 'État') || matchLabel(lines, 'Etat') || ''
  const couleur = matchLabel(lines, 'Couleur') || ''

  // Titre : si URL connue, on dérive depuis le slug ; sinon on prend la 1ère
  // ligne du bloc info, qui apparaît juste avant la ligne "taille · état · marque".
  let titre = ''
  if (url) {
    const slugMatch = url.match(/\/items\/\d+-([a-z0-9-]+)/i)
    if (slugMatch) titre = slugMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
  if (!titre) {
    // Heuristique : ligne courte qui précède la ligne descriptive Vinted.
    // Deux formes possibles :
    //   "S / 36 / 8 · Très bon état · Inconnu" (2 séparateurs)
    //   "Neuf sans étiquette · Vintage Dressing" (1 séparateur, pas de taille — bijoux)
    const descRe = /^[^·]+·[^·]/
    const NOISE = /^(Publicit[ée]|Vendu|Enlev[ée]\s*!|Dressing du membre|Articles similaires)$/i
    for (let i = 1; i < lines.length; i++) {
      if (
        descRe.test(lines[i]) &&
        lines[i - 1].length < 120 &&
        lines[i - 1].length > 3 &&
        !NOISE.test(lines[i - 1])
      ) {
        titre = lines[i - 1]
        break
      }
    }
  }

  // Description : entre "Ajouté Il y a X" (ou similaire) et "Envoi"/"Achète et vends"
  const description = extractBlock(
    text,
    /(?:Ajout[ée]\s+Il y a\s+[^\n]+|Ajout[ée]\s+il y a\s+[^\n]+)\n+/,
    /\n+(?:Envoi|Ach[èe]te et vends|Articles similaires|Voir plus|Acheter|Faire une offre)/
  )

  // Vendeur : pseudo Vinted qui apparaît juste avant un nombre (= note vendeur)
  // puis le badge "Publie activement". Ancrage robuste pour éviter de matcher
  // des mots français isolés comme "Vendu" ou "Suivre".
  let vendeur = ''
  const vendeurMatch = text.match(
    /([a-z][a-z0-9_.\-]{2,29})\s*\n+\s*\d{1,5}\s*\n+\s*Publie\s+activement/im
  )
  if (vendeurMatch) vendeur = vendeurMatch[1]

  // Prix article : on prend le 1er prix sous la forme "NN,NN €" non précédé par "incl"
  const prixArticle = extractAmount(text, /(?:^|\n)\s*(\d{1,4}[,.]\d{2})\s*€\s*(?:\n|$)/)
  // Prix avec protection : "NN,NN €\nInclut la Protection acheteurs"
  const prixAvecProtection = extractAmount(
    text,
    /(\d{1,4}[,.]\d{2})\s*€\s*\n+\s*Inclut la Protection acheteurs/i
  )

  return {
    ok: true,
    provenance: 'vinted-page',
    titre: titre.trim(),
    marque: marque.trim(),
    taille: taille.trim(),
    couleur: couleur.trim(),
    etat: etat.trim(),
    description: description.trim(),
    vendeur,
    prixArticle,
    prixAvecProtection,
    itemId,
    url,
  }
}

/**
 * ID Firestore déterministe pour un produit issu d'une page Vinted.
 * Quand on a un itemId, on peut matcher proprement avec un mail "Ton reçu"
 * arrivant plus tard pour la même pièce.
 */
export function vintedPageDocId(itemId: string): string {
  return `vinted_item_${itemId}`
}

// ---------------------------------------------------------------------------

/**
 * Cherche un label (ex: "Marque") suivi de sa valeur. Tolère trois mises en
 * page de copier-coller :
 *   - "Marque Inconnu" (espace entre)
 *   - "MarqueInconnu" (collé, fréquent quand Vinted rend les deux comme spans
 *     adjacents)
 *   - "Marque\nInconnu" (label seul, valeur sur la ligne suivante)
 * Retourne `null` si le label n'est pas trouvé.
 */
function matchLabel(lines: string[], label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // \s* (zéro ou plus) pour gérer le cas "MarqueInconnu" sans espace.
  const sameLineRe = new RegExp(`^${escaped}\\s*(.+)$`, 'i')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(sameLineRe)
    if (m && m[1].toLowerCase() !== label.toLowerCase()) return m[1].trim()
    if (line.toLowerCase() === label.toLowerCase() && lines[i + 1]) {
      return lines[i + 1].trim()
    }
  }
  return null
}

function extractFirst(text: string, re: RegExp): string | null {
  const m = text.match(re)
  return m ? m[0] : null
}

function extractAmount(text: string, re: RegExp): number | null {
  const m = text.match(re)
  if (!m) return null
  const raw = m[1].replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

function extractBlock(text: string, startRe: RegExp, endRe: RegExp): string {
  const startMatch = text.match(startRe)
  if (!startMatch) return ''
  const afterStart = text.slice((startMatch.index ?? 0) + startMatch[0].length)
  const endMatch = afterStart.match(endRe)
  const block = endMatch ? afterStart.slice(0, endMatch.index) : afterStart
  return block.split('\n').map((l) => l.trim()).filter(Boolean).join(' ')
}

function normalize(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/ /g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
}
