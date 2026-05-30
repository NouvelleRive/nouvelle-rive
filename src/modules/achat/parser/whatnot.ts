// Parser des mails Whatnot "Merci pour ton achat chez {vendeur} sur Whatnot !".
//
// Spécificité Whatnot : un mail peut contenir PLUSIEURS commandes regroupées
// (lots achetés sur la même session live). Chaque commande a son propre
// Order # et son prix total → on retourne un tableau d'items.
//
// Le contenu d'une annonce Whatnot étant générique (titre du lot, prix), il
// n'y a pas d'extraction marque/taille/couleur — c'est à compléter à la main
// lors de la réception ou via les photos de la pièce.

export type WhatnotItem = {
  /** Titre du lot tel qu'affiché dans le mail (ex: "PAS D'ANNULATION PDD 50€ #4") */
  titre: string
  /** ID de commande Whatnot, clé de dédup */
  orderId: string
  /** Total payé en € (sous-total + taxe + livraison) */
  prixTotal: number
  /** Sous-total en € (avant taxe et port) */
  prixSousTotal: number
  /** Taxe incluse en € */
  taxe: number
  /** Frais de livraison en € */
  livraison: number
}

export type WhatnotPurchase = {
  ok: true
  provenance: 'whatnot'
  /** Vendeur Whatnot (souvent un pseudo de boutique) */
  vendeur: string
  /** Une ou plusieurs commandes dans le même mail */
  items: WhatnotItem[]
}

export type WhatnotResult = WhatnotPurchase | { ok: false; reason: string }

/**
 * Parse un mail Whatnot d'achat. Le format Whatnot regroupe les items achetés
 * lors d'une même session live dans un seul mail, séparés par "Order #" et
 * "Total". On extrait chaque bloc.
 */
export function parseWhatnotPurchase(rawBody: string): WhatnotResult {
  const text = normalize(rawBody)

  // Vérification grossière : on doit voir "Whatnot" + au moins un "Order #"
  if (!/whatnot/i.test(text)) return { ok: false, reason: 'Pas un mail Whatnot' }
  if (!/Order\s*#\s*\d+/i.test(text)) return { ok: false, reason: 'Aucun Order # trouvé' }

  // Vendeur : extrait du sujet/intro "chez {vendeur} sur Whatnot"
  const vendeur =
    extractText(text, /chez\s+([a-z0-9_.\-]+)\s+sur\s+Whatnot/i) ||
    extractText(text, /achat\s+chez\s+([a-z0-9_.\-]+)/i) ||
    ''

  // On découpe en blocs "item" : chaque bloc commence par un titre et contient
  // un Order # + un Total. On capture greedy entre deux marqueurs.
  // Format observé :
  //   <titre>
  //   Order #1064236555
  //   €78.18
  //   ...
  //   Sous-total €74.00
  //   Taxe (incluse) €0.70
  //   Livraison €4.18
  //   Total €78.18
  const itemRe =
    /([^\n]+?)\s*\n+\s*Order\s*#\s*(\d+)\s*\n+\s*€\s*([\d.,]+)[\s\S]*?Sous-total\s*€\s*([\d.,]+)[\s\S]*?Taxe[^€]*€\s*([\d.,]+)[\s\S]*?Livraison\s*€\s*([\d.,]+)[\s\S]*?Total\s*€\s*([\d.,]+)/gi

  const items: WhatnotItem[] = []
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(text))) {
    const titre = m[1].trim()
    const orderId = m[2]
    // m[3] = headline total (avant détail), on prend plutôt m[7] qui est "Total" en bas du bloc
    const prixSousTotal = toNumber(m[4])
    const taxe = toNumber(m[5])
    const livraison = toNumber(m[6])
    const prixTotal = toNumber(m[7])
    if (!orderId || !titre) continue
    items.push({ titre, orderId, prixTotal, prixSousTotal, taxe, livraison })
  }

  if (items.length === 0) {
    return { ok: false, reason: 'Aucune commande exploitable extraite du mail' }
  }

  return {
    ok: true,
    provenance: 'whatnot',
    vendeur,
    items,
  }
}

/** ID Firestore déterministe pour une commande Whatnot (anti-doublon strict). */
export function whatnotDocId(orderId: string): string {
  return `whatnot_${orderId}`
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
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
