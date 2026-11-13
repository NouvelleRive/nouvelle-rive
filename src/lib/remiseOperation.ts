// src/lib/remiseOperation.ts
// Opérations de remise co-financées (Black Week, soldes, offres ponctuelles…).
//
// Principe : la déposante choisit une remise client sur ses pièces, NOUVELLE RIVE
// prend en charge une part de cette remise (partNR) sur sa commission.
// Le prix de départ (produit.prix) ne bouge JAMAIS : le prix client est calculé
// à la volée, uniquement pendant la période de l'opération.
//
// Calcul « 50/50 réel » (partNR = 0,5) : la part NR est retirée de la commission TTC,
// donc NR et la déposante perdent chacune exactement la moitié de la remise.
//   Ex : 100 €, -20 %, commission 40 % → client 80 €, commission TTC 48 − 10 = 38 €
//        (31,67 HT + 6,33 TVA), reversé 80 − 38 = 42 € (52 sans remise → −10 €).
//
// ── NOUVELLE CAMPAGNE (soldes, offre…) ─────────────────────────────────────
//   1. Déclarer une constante OperationRemise ci-dessous (dates, libellé, plafonds…).
//   2. Changer UNE ligne : `OPERATION_EN_COURS = <nouvelle constante>`.
//   Tout le reste suit : champ produit, site (badges, prix barré, filtre promo),
//   paiement en ligne, remises auto Square en caisse, ventes figées, facture.
//   Le % choisi par pièce est stocké dans `produit.remiseBlackWeek` (nom historique,
//   commun à toutes les opérations).

export type OperationRemise = {
  /** Identifiant stable (stocké sur les ventes). */
  id: string
  /** Libellé affiché (facture, ticket Square, UI). */
  label: string
  /** Premier jour inclus, `yyyy-MM-dd`, heure de Paris. */
  debut: string
  /** Dernier jour inclus, `yyyy-MM-dd`, heure de Paris. */
  fin: string
  /** Part de la remise prise en charge par NR (0,5 = moitié). */
  partNR: number
  /** Plafond de remise selon le taux de commission (%), du plus haut au plus bas. */
  plafonds: { tauxComMin: number; remiseMax: number }[]
  /** Plafond de remise pour le stock maison (pièces achetées NR / ACH). */
  plafondMaison: number
  /** Remise minimale proposée (%) et pas entre deux choix (ex. 10, 15, 20…). */
  remiseMin: number
  pas: number
}

export const BLACK_WEEK_2026: OperationRemise = {
  id: 'blackweek2026',
  label: 'Black Week',
  debut: '2026-11-23',
  fin: '2026-11-29',
  partNR: 0.5,
  plafonds: [
    { tauxComMin: 40, remiseMax: 50 },
    { tauxComMin: 30, remiseMax: 30 },
    { tauxComMin: 20, remiseMax: 20 },
  ],
  plafondMaison: 50,
  remiseMin: 10,
  pas: 5,
}

/** L'opération en cours — LA SEULE LIGNE À CHANGER pour une nouvelle campagne. */
export const OPERATION_EN_COURS: OperationRemise = BLACK_WEEK_2026

/** Libellé en capitales pour les badges (ex. « BLACK WEEK »). */
export const libelleMaj = (op: OperationRemise) => op.label.toUpperCase()

/** Plafond d'une pièce : stock maison (NR/ACH) → plafondMaison ; chineuse → selon sa commission. */
export function plafondPiece(op: OperationRemise, opts: { maison?: boolean; tauxCom?: number }): number {
  if (opts.maison) return op.plafondMaison
  return typeof opts.tauxCom === 'number' ? plafondRemise(op, opts.tauxCom) : 0
}

/** Choix de remise proposés : remiseMin, +pas… jusqu'au plafond de la pièce. */
export function choixRemisePiece(op: OperationRemise, opts: { maison?: boolean; tauxCom?: number }): number[] {
  const max = plafondPiece(op, opts)
  const out: number[] = []
  for (let v = op.remiseMin; v <= max; v += op.pas) out.push(v)
  return out
}

/** Choix de remise proposés à la chineuse : remiseMin, +pas… jusqu'au plafond. */
export function choixRemise(op: OperationRemise, tauxCom: number): number[] {
  const max = plafondRemise(op, tauxCom)
  const out: number[] = []
  for (let v = op.remiseMin; v <= max; v += op.pas) out.push(v)
  return out
}

/** « du 23 au 29/11 » */
export function periodeCourte(op: OperationRemise): string {
  const [, m1, d1] = op.debut.split('-')
  const [, m2, d2] = op.fin.split('-')
  return m1 === m2 ? `du ${Number(d1)} au ${Number(d2)}/${m2}` : `du ${Number(d1)}/${m1} au ${Number(d2)}/${m2}`
}

/** Fin de l'opération (dernier jour 23:59:59 heure de Paris) en ms epoch. */
export function finOperationMs(op: OperationRemise): number {
  const utc = Date.parse(`${op.fin}T23:59:59Z`)
  const d = new Date(utc)
  const paris = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Paris' })).getTime()
  const enUtc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()
  return utc - (paris - enUtc)
}

/** Infos recopiées sur le produit pour le trigger Square (les Firebase Functions
 *  ne peuvent pas importer cette lib). */
export function infosOperation(op: OperationRemise) {
  return { id: op.id, label: op.label, debut: op.debut, fin: op.fin }
}

const TVA = 0.20

/** Arrondi au centime — à n'appliquer que sur les montants finaux. */
export const arrondiCentime = (n: number) => Math.round(n * 100) / 100

/** Date du jour `yyyy-MM-dd` en heure de Paris. */
export function jourParis(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(date)
}

/** L'opération est-elle en cours à cette date (bornes incluses, heure de Paris) ? */
export function operationActive(op: OperationRemise, date: Date = new Date()): boolean {
  const j = jourParis(date)
  return j >= op.debut && j <= op.fin
}

/** Remise max autorisée (%) pour un taux de commission (%) donné. 0 si aucun palier. */
export function plafondRemise(op: OperationRemise, tauxCom: number): number {
  const p = [...op.plafonds].sort((a, b) => b.tauxComMin - a.tauxComMin)
    .find(x => tauxCom >= x.tauxComMin)
  return p ? p.remiseMax : 0
}

/** Valide une saisie de remise : entier entre 0 et le plafond. Renvoie un message d'erreur ou null. */
export function erreurRemise(op: OperationRemise, remisePct: number, tauxCom: number): string | null {
  const max = plafondRemise(op, tauxCom)
  if (!Number.isInteger(remisePct)) return 'La remise doit être un nombre entier.'
  if (remisePct < 0) return 'La remise ne peut pas être négative.'
  if (remisePct > max) return `Remise maximum pour ta commission de ${tauxCom} % : -${max} %.`
  return null
}

/** Remise effective (%) à cette date : 0 hors période. */
export function remiseEffective(op: OperationRemise, remisePct: number | undefined, date: Date = new Date()): number {
  if (!remisePct || remisePct <= 0) return 0
  return operationActive(op, date) ? remisePct : 0
}

/** Prix payé par le client (arrondi au centime, c'est un montant encaissé). */
export function prixClient(prixDepart: number, remisePct: number): number {
  if (!remisePct || remisePct <= 0) return prixDepart
  return arrondiCentime(prixDepart * (1 - remisePct / 100))
}

export type LigneVente = { prixDepart: number; prixClient: number }

export type TotauxFacture = {
  /** Lot de pièces vintage : total des prix client. */
  totalPrixClient: number
  /** Commission HT sur prix de départ (calcul actuel). */
  commissionBruteHT: number
  /** Prise en charge NR, en HT (positif ; à afficher en négatif). */
  priseEnChargeHT: number
  /** Commission nette HT = brute − prise en charge. */
  commissionHT: number
  tva: number
  commissionTTC: number
  /** Net à reverser à la déposante. */
  net: number
  /** Au moins une vente remisée → afficher la ligne de prise en charge. */
  avecRemise: boolean
}

/**
 * Totaux d'une facture déposante. Sans aucune remise, donne exactement le calcul
 * historique : commissionHT = CA × taux, TTC = HT × 1,2, net = CA − TTC.
 * Rien n'est arrondi ici : arrondir à l'affichage (montants finaux).
 */
export function totauxFacture(ventes: LigneVente[], tauxCom: number, partNR: number): TotauxFacture {
  const taux = tauxCom / 100
  let totalPrixClient = 0, totalPrixDepart = 0, totalRemise = 0
  for (const v of ventes) {
    totalPrixClient += v.prixClient
    totalPrixDepart += v.prixDepart
    totalRemise += Math.max(v.prixDepart - v.prixClient, 0)
  }
  const commissionBruteHT = totalPrixDepart * taux
  // Part NR retirée du TTC → en HT : ÷ 1,2
  const priseEnChargeHT = (totalRemise * partNR) / (1 + TVA)
  const commissionHT = commissionBruteHT - priseEnChargeHT
  const commissionTTC = commissionHT * (1 + TVA)
  const tva = commissionTTC - commissionHT
  return {
    totalPrixClient,
    commissionBruteHT,
    priseEnChargeHT,
    commissionHT,
    tva,
    commissionTTC,
    net: totalPrixClient - commissionTTC,
    avecRemise: totalRemise > 0,
  }
}

/**
 * Remise à AFFICHER sur le site (%) : remise effective, ou aperçu forcé par
 * `?apercu=blackweek` dans l'URL (affichage seulement — le paiement, lui,
 * n'applique la remise que pendant la vraie période).
 */
export function remiseAffichee(op: OperationRemise, remisePct: number | undefined): number {
  if (!remisePct || remisePct <= 0) return 0
  if (operationActive(op)) return remisePct
  try {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('apercu') === 'blackweek') return remisePct
  } catch { /* pas d'URL */ }
  return 0
}

// ── Ventes → facture / paiement (même calcul partout) ──────────────────────

export type VenteFacturable = {
  prixVenteReel?: number
  prix?: number | null
  prixInitial?: number | null
  /** % figé à la vente (0/absent = vente sans remise d'opération) */
  remiseBlackWeek?: number
}

/** Prix réellement encaissé d'une vente (même règle que la facture historique). */
export const prixEncaisse = (v: VenteFacturable): number =>
  typeof v.prixVenteReel === 'number' ? v.prixVenteReel : (v.prix || 0)

/** Prix de départ : `prixInitial` UNIQUEMENT pour une vente remisée par une
 *  opération ; sinon le prix encaissé (→ calcul strictement identique à avant). */
export const prixDepartVente = (v: VenteFacturable): number =>
  (v.remiseBlackWeek ?? 0) > 0 && typeof v.prixInitial === 'number' ? v.prixInitial : prixEncaisse(v)

/** Totaux facture/paiement d'une chineuse pour une liste de ventes.
 *  @param tauxCom taux de commission en % (ex. 40) */
export function totauxVentes(ventes: VenteFacturable[], tauxCom: number, op: OperationRemise = OPERATION_EN_COURS): TotauxFacture {
  return totauxFacture(ventes.map(v => ({ prixClient: prixEncaisse(v), prixDepart: prixDepartVente(v) })), tauxCom, op.partNR)
}

// ── Suivi d'une opération (page admin Opérations) ───────────────────────────

export type ProduitOperation = {
  trigramme?: string | null
  remiseBlackWeek?: number
  vendu?: boolean
  quantite?: number
  statut?: string
  statutRecuperation?: unknown
}

export type StatsOperation = {
  /** Pièces en stock avec une remise */
  nbPieces: number
  /** Nombre de pièces par % (ex. { 10: 4, 30: 50 }) */
  parPct: Record<number, number>
  /** Par chineuse : nb de pièces et répartition par % */
  parChineuse: { trigramme: string; nbPieces: number; parPct: Record<number, number> }[]
}

/** Pièce en stock (non vendue, non récupérée) avec une remise d'opération. */
export function estEngagee(p: ProduitOperation): boolean {
  if ((Number(p.remiseBlackWeek) || 0) <= 0 || p.vendu || (p.quantite ?? 1) <= 0) return false
  return !(p.statut === 'retour' || p.statut === 'supprime' || p.statutRecuperation)
}

/** Pièces en stock (non vendues, non récupérées) engagées dans l'opération. */
export function statsOperation(produits: ProduitOperation[]): StatsOperation {
  const parPct: Record<number, number> = {}
  const parTri = new Map<string, { trigramme: string; nbPieces: number; parPct: Record<number, number> }>()
  let nbPieces = 0
  for (const p of produits) {
    if (!estEngagee(p)) continue
    const pct = Number(p.remiseBlackWeek) || 0
    const tri = (p.trigramme || '?').toUpperCase()
    nbPieces++
    parPct[pct] = (parPct[pct] || 0) + 1
    if (!parTri.has(tri)) parTri.set(tri, { trigramme: tri, nbPieces: 0, parPct: {} })
    const c = parTri.get(tri)!
    c.nbPieces++
    c.parPct[pct] = (c.parPct[pct] || 0) + 1
  }
  return { nbPieces, parPct, parChineuse: Array.from(parTri.values()).sort((a, b) => b.nbPieces - a.nbPieces) }
}
