// Parser des factures Fleek (PDF exporté en texte ou aperçu Gmail).
//
// Spécificité Fleek : chaque ligne de la facture = un LOT de N pièces identiques
// (ex: 20 polos Ralph Lauren à 291,17 € le lot → 14,56 € la pièce). À la
// création on génère N brouillons individuels par lot, tous sous chineuse NR.
//
// Source : la cliente colle le contenu texte de l'aperçu PDF Gmail. Plus tard
// la boîte mail dédiée achat lira le PDF directement via Gmail watcher.
//
// Le grand total inclut un éventuel discount et un Buyer Protection Fee qu'on
// ignore volontairement : la cliente a confirmé qu'il n'y aura plus de remise
// par la suite et on veut un prix d'achat unitaire stable = prixLigne / qty.

export type FleekLot = {
  /** Libellé du lot tel qu'apparu sur la facture (ex: "Premium Ralph Lauren Polo Shirts") */
  titre: string
  /** Nombre de pièces dans le lot (ex: 20) */
  qtyParLot: number
  /** Subtotal de la ligne en € (prix du lot complet) */
  prixLot: number
  /** Prix d'achat unitaire = prixLot / qtyParLot, arrondi à 2 décimales */
  prixUnitaire: number
}

export type FleekInvoice = {
  ok: true
  provenance: 'fleek'
  /** Numéro de commande Fleek (sans le #) — sert d'ID anti-doublon */
  orderId: string
  /** Date de commande */
  dateCommande: Date
  /** Lots achetés (un par ligne de la facture) */
  lots: FleekLot[]
}

export type FleekInvoiceResult = FleekInvoice | { ok: false; reason: string }

/**
 * Parse le texte d'une facture Fleek. Tolère le copier-coller depuis l'aperçu
 * Gmail du PDF (les sauts de ligne du PDF sont préservés).
 */
export function parseFleekInvoice(rawBody: string): FleekInvoiceResult {
  const text = normalize(rawBody)

  if (!/Fleek/i.test(text)) {
    return { ok: false, reason: 'Pas une facture Fleek (mot "Fleek" introuvable)' }
  }

  const orderId = extractText(text, /Order\s*Number:\s*#?\s*(\d+)/i)
  if (!orderId) return { ok: false, reason: 'Order Number introuvable' }

  const dateStr = extractText(text, /Order\s*Date:\s*([0-9T:\-.Z+]+)/i)
  const dateCommande = dateStr ? new Date(dateStr) : new Date()
  if (Number.isNaN(dateCommande.getTime())) {
    return { ok: false, reason: 'Order Date invalide' }
  }

  // On isole la section "items" pour ne pas matcher par accident les totaux
  // du bas (Subtotal/Discount/Buyer Protection Fee/Grand total).
  //
  // Le mot "Subtotal" apparaît au moins 2 fois sur la facture Fleek :
  //   - 1× dans le header de la table ("Items Qty Price Tax Tax Amount Subtotal")
  //   - 1× dans les totaux du bas ("Subtotal: €924.28")
  // Le bloc items = ce qui est entre les deux. Robuste au pdfjs qui peut
  // éclater les cellules d'en-tête sur des lignes séparées.
  let block = text
  const subtotalHits = [...text.matchAll(/\bSubtotal\b/gi)]
  if (subtotalHits.length >= 2) {
    const first = subtotalHits[0]
    const last = subtotalHits[subtotalHits.length - 1]
    const start = (first.index ?? 0) + first[0].length
    const end = last.index ?? text.length
    if (end > start) block = text.slice(start, end)
  }

  // Selon la source (copier-coller texte vs extraction pdfjs), le bloc peut
  // arriver soit en lignes "humaines" (titre / qty / prix par triplets ou
  // colonnes), soit éclaté en tokens (chaque cellule sur sa propre ligne).
  // On utilise des regex globales avec \s+ comme séparateur pour tolérer
  // tous les formats — espaces, tabulations, sauts de ligne se valent.

  // Regex globales (réutilisées plusieurs fois → on les recrée à chaque
  // appel via factory pour éviter les soucis de lastIndex partagé).
  const pieceRe = () => /(\d+)\s*\/\s*piece/gi
  const priceRe = () =>
    /\d+\s+€\s*([\d.,]+)\s+\d+\s*%\s+€\s*[\d.,]+\s+€\s*([\d.,]+)/g

  const qtyHits = [...block.matchAll(pieceRe())].map((m) => ({
    index: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
    qty: parseInt(m[1], 10),
  }))
  const priceHits = [...block.matchAll(priceRe())].map((m) => ({
    prixLot: toNumber(m[2]),
  }))

  // Titre = ce qui précède chaque "N / piece", borné par le précédent hit
  // (ou début du bloc). On retire les fragments de prix éventuels et tout
  // ce qui ressemble à des chiffres/symboles isolés.
  const titres: string[] = []
  let lastEnd = 0
  for (const qh of qtyHits) {
    let segment = block.slice(lastEnd, qh.index)
    segment = segment.replace(priceRe(), ' ')
    const cleaned = segment
      .split(/\s+/)
      .filter((tok) => tok && !/^€?[\d.,%]+$/.test(tok))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    titres.push(cleaned)
    lastEnd = qh.end
  }

  // Zip strict : on n'avance que si on a les 3 (titre, qty, prix) au même index.
  const lots: FleekLot[] = []
  const count = Math.min(qtyHits.length, priceHits.length, titres.length)
  for (let i = 0; i < count; i++) {
    const titre = titres[i]
    const qtyParLot = qtyHits[i].qty
    const prixLot = priceHits[i].prixLot
    if (!titre || qtyParLot <= 0 || prixLot <= 0) continue
    const prixUnitaire = Math.round((prixLot / qtyParLot) * 100) / 100
    lots.push({ titre, qtyParLot, prixLot, prixUnitaire })
  }

  if (lots.length === 0) {
    return {
      ok: false,
      reason: `Aucun lot extrait (qtys: ${qtyHits.length}, prix: ${priceHits.length}, titres: ${titres.length})`,
    }
  }

  return { ok: true, provenance: 'fleek', orderId, dateCommande, lots }
}

/**
 * ID Firestore déterministe pour une pièce issue d'un lot Fleek (anti-doublon
 * strict : re-parser la même facture overwrite les mêmes docs).
 */
export function fleekPieceDocId(orderId: string, lotIdx: number, pieceIdx: number): string {
  return `fleek_${orderId}_${lotIdx}_${pieceIdx}`
}

// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/ /g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
}

function extractText(text: string, re: RegExp): string | null {
  const m = text.match(re)
  return m ? m[1].trim() : null
}

function toNumber(s: string): number {
  const n = parseFloat(s.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
