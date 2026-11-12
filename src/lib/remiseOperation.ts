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
  /** Remise minimale proposée (%) et pas entre deux choix (ex. 10, 15, 20…). */
  remiseMin: number
  pas: number
}

export const BLACK_WEEK_2026: OperationRemise = {
  id: 'blackweek2026',
  label: 'Black Week',
  debut: '2026-11-12', // TEST — remettre '2026-11-23'
  fin: '2026-11-29',
  partNR: 0.5,
  plafonds: [
    { tauxComMin: 40, remiseMax: 50 },
    { tauxComMin: 30, remiseMax: 30 },
    { tauxComMin: 20, remiseMax: 20 },
  ],
  remiseMin: 10,
  pas: 5,
}

/** L'opération en cours — LA SEULE LIGNE À CHANGER pour une nouvelle campagne. */
export const OPERATION_EN_COURS: OperationRemise = BLACK_WEEK_2026

/** Libellé en capitales pour les badges (ex. « BLACK WEEK »). */
export const libelleMaj = (op: OperationRemise) => op.label.toUpperCase()

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
