// Parser des mails de confirmation d'achat Vinted ("Ton reçu pour la commande …").
//
// Le mail Vinted ne contient PAS de photos ni de lien vers l'annonce — uniquement
// le texte (vendeur, titre, montants, transaction). Les photos seront récupérées
// dans une étape ultérieure (autres mails Vinted ou autre canal).
//
// Le parser accepte indifféremment le corps HTML brut ou le rendu texte plat
// (copier-coller depuis Gmail). On strip les balises HTML puis on extrait les
// champs labellisés via regex tolérantes aux variations d'espaces.

import type { AchatProvenance } from '../types'

export type VintedReceipt = {
  ok: true
  provenance: 'vinted'
  /** Pseudo Vinted du vendeur (ex: "fripants") */
  vendeur: string
  /** Titre brut de l'annonce (ex: "Jean Twist Barrel Leg COS gris foncé / noir | W27") */
  titre: string
  /** Prix de l'article seul, en € */
  prixArticle: number
  /** Frais de port, en € */
  fraisPort: number
  /** Frais de Protection acheteurs Vinted, en € */
  fraisProtection: number
  /** Montant total payé (article + port + protection), en € */
  prixTotal: number
  /** Mode de paiement (ex: "Apple Pay") */
  modePaiement: string
  /** Date+heure du paiement */
  dateAchat: Date
  /** N° de transaction Vinted — sert d'ID anti-doublon */
  transactionId: string
}

export type VintedReceiptResult = VintedReceipt | { ok: false; reason: string }

/**
 * Parse un mail de confirmation d'achat Vinted. Accepte HTML ou texte plat.
 * Retourne `{ ok: false, reason }` si un champ obligatoire manque.
 */
export function parseVintedReceipt(rawBody: string): VintedReceiptResult {
  const text = htmlToText(rawBody)

  // Tous les labels sont ancrés en début de ligne (^…/m) pour ne pas matcher
  // par accident "votre commande Vinted :" ou autre phrase libre.
  const vendeur = extractText(text, /^Vendeur\s+([A-Za-z0-9_.\-]+)/m)
  const titre = extractText(text, /^Commande\s+(.+?)\s*$/m)
  const prixTotal = extractAmount(text, /^Montant\s*pay[eé]\s+([\d.,\s]+)\s*€/im)
  const prixArticle = extractAmount(text, /^Article\s+([\d.,\s]+)\s*€/m)
  const fraisPort = extractAmount(text, /^Frais de port\s+([\d.,\s]+)\s*€/m)
  const fraisProtection = extractAmount(text, /^Frais de Protection acheteurs\s+([\d.,\s]+)\s*€/m)
  const modePaiement = extractText(text, /^Mode de paiement\s+([^\n(]+?)\s*\(/m)
  const dateStr = extractText(text, /^Date du paiement\s+(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}\s*h\s*\d{1,2})/m)
  const transactionId = extractText(text, /^N°\s*de transaction\s+(\d+)/m)

  const missing: string[] = []
  if (!vendeur) missing.push('vendeur')
  if (!titre) missing.push('titre')
  if (prixTotal === null) missing.push('prixTotal')
  if (!transactionId) missing.push('transactionId')
  if (!dateStr) missing.push('dateAchat')
  if (missing.length > 0) {
    return { ok: false, reason: `Champs manquants: ${missing.join(', ')}` }
  }

  const dateAchat = parseVintedDate(dateStr!)
  if (!dateAchat) return { ok: false, reason: 'Date du paiement illisible' }

  return {
    ok: true,
    provenance: 'vinted',
    vendeur: vendeur!,
    titre: titre!.trim(),
    prixArticle: prixArticle ?? 0,
    fraisPort: fraisPort ?? 0,
    fraisProtection: fraisProtection ?? 0,
    prixTotal: prixTotal!,
    modePaiement: (modePaiement || '').trim(),
    dateAchat,
    transactionId: transactionId!,
  }
}

/**
 * ID Firestore déterministe pour un achat Vinted (anti-doublon strict :
 * si le même mail est re-parsé, on overwrite le même doc).
 * Convention identique à la règle anti-doublons ventes du projet.
 */
export function vintedDocId(transactionId: string): string {
  return `vinted_${transactionId}`
}

// ---------------------------------------------------------------------------

function htmlToText(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(tr|td|th|p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&euro;/g, '€')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
}

function extractText(text: string, re: RegExp): string | null {
  const m = text.match(re)
  return m ? m[1].trim() : null
}

function extractAmount(text: string, re: RegExp): number | null {
  const m = text.match(re)
  if (!m) return null
  // Vinted formate "70,00 €" ou "1 234,56 €" — gérer virgule décimale + espace milliers.
  const raw = m[1].replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

function parseVintedDate(s: string): Date | null {
  // Format Vinted FR : "26/05/2026 11 h 52"
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})\s*h\s*(\d{1,2})/)
  if (!m) return null
  const [, dd, mm, yyyy, hh, min] = m
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min))
  return Number.isNaN(d.getTime()) ? null : d
}
