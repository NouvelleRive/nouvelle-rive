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

  // On isole la section "items" entre "Items …" et "Subtotal:" pour ne pas
  // matcher par accident les totaux du bas.
  let block = text
  const headerIdx = text.search(/Items[ \t]+Qty[ \t]+Price/i)
  if (headerIdx >= 0) {
    const afterHeader = text.slice(headerIdx).replace(/^Items[^\n]*\n/i, '')
    const endIdx = afterHeader.search(/\n\s*Subtotal:/i)
    block = endIdx >= 0 ? afterHeader.slice(0, endIdx) : afterHeader
  }

  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
  const lots: FleekLot[] = []

  // Format de chaque item (3 zones de lignes consécutives) :
  //   <titre — peut tenir sur 1 ou 2 lignes>
  //   <N> / piece
  //   1 €PRIX_LOT 0% €0.00 €SUBTOTAL
  for (let i = 0; i < lines.length; i++) {
    const qtyMatch = lines[i].match(/^(\d+)\s*\/\s*piece$/i)
    if (!qtyMatch) continue
    const qtyParLot = parseInt(qtyMatch[1], 10)
    if (qtyParLot <= 0) continue

    const priceLine = lines[i + 1] || ''
    const priceMatch = priceLine.match(
      /^\d+\s+€\s*([\d.,]+)\s+\d+%\s+€\s*[\d.,]+\s+€\s*([\d.,]+)$/
    )
    if (!priceMatch) continue
    const prixLot = toNumber(priceMatch[2])
    if (prixLot <= 0) continue

    // Titre = jusqu'à 2 lignes juste avant. On s'arrête si on retombe sur
    // un marqueur d'item précédent (X / piece ou ligne de prix).
    const titreLines: string[] = []
    for (let j = i - 1; j >= 0 && titreLines.length < 2; j--) {
      const prev = lines[j]
      if (/^\d+\s*\/\s*piece$/i.test(prev)) break
      if (/^\d+\s+€\s*[\d.,]+\s+\d+%/i.test(prev)) break
      titreLines.unshift(prev)
    }
    const titre = titreLines.join(' ').replace(/\s+/g, ' ').trim()
    if (!titre) continue

    const prixUnitaire = Math.round((prixLot / qtyParLot) * 100) / 100
    lots.push({ titre, qtyParLot, prixLot, prixUnitaire })
    i += 1
  }

  if (lots.length === 0) {
    return { ok: false, reason: 'Aucun lot extrait de la facture' }
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
