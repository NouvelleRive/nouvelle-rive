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
