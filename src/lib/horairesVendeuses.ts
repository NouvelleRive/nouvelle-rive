// Horaires des postes vendeuses — source unique de vérité.
//
// Les clés Firestore '12-20' et '11-17' sont des identifiants de poste stables :
// elles ne changent JAMAIS, même quand les horaires réels bougent.
//
// Bascule au 01/10/2026 :
//   '12-20' : 12h-20h (8h)  ->  14h-20h (6h)
//   '11-17' : 11h-17h (6h)  ->  11h-18h (7h)
//
// Tout ce qui dépend des horaires (libellés, heures prévues, attribution des
// ventes par tranche horaire, bonus, décalage de pointage) doit passer par ici.

export const HORAIRES_CUTOVER = '2026-10-01'

export const CRENEAUX_VENDEUSE = ['12-20', '11-17'] as const
export type CreneauVendeuse = (typeof CRENEAUX_VENDEUSE)[number]

export type Plage = { debut: number; fin: number }

/** Horaires réels d'un poste à une date donnée (`yyyy-MM-dd`). */
export function plageCreneau(cr: string, dateStr?: string): Plage | null {
  const ancien = !!dateStr && dateStr < HORAIRES_CUTOVER
  if (cr === '12-20') return ancien ? { debut: 12, fin: 20 } : { debut: 14, fin: 20 }
  if (cr === '11-17') return ancien ? { debut: 11, fin: 17 } : { debut: 11, fin: 18 }
  return null
}

/** Libellé affiché ('14-20', '11-18'…). */
export function labelCreneau(cr: string, dateStr?: string): string {
  const p = plageCreneau(cr, dateStr)
  return p ? `${p.debut}-${p.fin}` : cr
}

/** Durée du poste en heures. */
export function heuresCreneau(cr: string, dateStr?: string): number {
  const p = plageCreneau(cr, dateStr)
  return p ? p.fin - p.debut : 0
}

/** Première date du mois (`yyyy-MM`) — pour les calculs mensuels. */
export function premierJourDuMois(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}-01`
}

/**
 * Bonus vendeuse : à partir de cette date, le seuil de 1 000 € s'évalue créneau
 * par créneau (matin / soir séparément). Avant, il portait sur le CA du jour.
 */
export const BONUS_PAR_CRENEAU_DEPUIS = '2026-10-01'
export const SEUIL_BONUS = 1000

// ── Jours fixes datés ───────────────────────────────────────────────────────
// `joursFixes` = grille historique (celle d'avant la 1re période). Chaque
// changement d'organisation ajoute une période `{ depuis, jours }` : les mois
// déjà passés gardent la grille qui s'appliquait à l'époque.

export type JoursFixes = Record<string, string>
export type PeriodeJoursFixes = { depuis: string; jours: JoursFixes }
export type AvecJoursFixes = { joursFixes?: JoursFixes; joursFixesPeriodes?: PeriodeJoursFixes[] }

/** Grille de jours fixes applicable à une date (`yyyy-MM-dd`). */
export function joursFixesPour(v: AvecJoursFixes, dateStr: string): JoursFixes {
  const actives = (v.joursFixesPeriodes || [])
    .filter(p => p && p.depuis && p.depuis <= dateStr)
    .sort((a, b) => (a.depuis < b.depuis ? -1 : 1))
  if (actives.length > 0) return actives[actives.length - 1].jours || {}
  return v.joursFixes || {}
}

/**
 * Patch Firestore pour modifier la grille applicable à `dateStr` sans toucher
 * aux périodes précédentes (l'historique reste figé).
 */
export function patchJoursFixesPour(v: AvecJoursFixes, dateStr: string, jours: JoursFixes): Record<string, unknown> {
  const periodes = (v.joursFixesPeriodes || []).slice().sort((a, b) => (a.depuis < b.depuis ? -1 : 1))
  const idx = periodes.reduce((acc, p, i) => (p.depuis <= dateStr ? i : acc), -1)
  if (idx === -1) return { joursFixes: jours }
  periodes[idx] = { ...periodes[idx], jours }
  return { joursFixesPeriodes: periodes }
}
