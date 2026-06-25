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

  // Le PDF Fleek se copie soit en triplets (titre → qty → prix), soit en
  // 2 colonnes (tous les titres+qtys d'abord, puis toutes les lignes de prix).
  // On collecte les 3 informations en 3 passes indépendantes puis on zippe
  // par index — ça marche dans les deux cas.

  const PIECE_RE = /^(\d+)\s*\/\s*piece$/i
  const PRICE_RE = /^\d+\s+€\s*([\d.,]+)\s+\d+%\s+€\s*[\d.,]+\s+€\s*([\d.,]+)$/

  type QtyHit = { idx: number; qty: number }
  const qtyHits: QtyHit[] = []
  const priceHits: { prixLot: number }[] = []
  for (let i = 0; i < lines.length; i++) {
    const qm = lines[i].match(PIECE_RE)
    if (qm) {
      const q = parseInt(qm[1], 10)
      if (q > 0) qtyHits.push({ idx: i, qty: q })
      continue
    }
    const pm = lines[i].match(PRICE_RE)
    if (pm) {
      const subtotal = toNumber(pm[2])
      if (subtotal > 0) priceHits.push({ prixLot: subtotal })
    }
  }

  // Titre = ce qui précède chaque "N / piece", jusqu'au précédent "N / piece"
  // (ou début de bloc), en filtrant les lignes prix qui auraient pu s'intercaler.
  const titres: string[] = []
  let lastIdx = -1
  for (const { idx } of qtyHits) {
    const slice = lines.slice(lastIdx + 1, idx).filter((l) => !PRICE_RE.test(l))
    titres.push(slice.join(' ').replace(/\s+/g, ' ').trim())
    lastIdx = idx
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
