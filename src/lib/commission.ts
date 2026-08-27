// src/lib/commission.ts
// Commission de l'acheteuse, calculée sur sa marge nette HT cumulée.
// Barème par tranche (marginal) :
//   - 10 % sur les premiers 4 000 € de marge HT
//   - 15 % sur la part au-delà de 4 000 €
// Ex : 5 000 € de marge → 4000×10% + 1000×15% = 400 + 150 = 550 €.
//
// Brique découpable : ce barème vit ici seul, réutilisable côté perf acheteuse
// et côté admin.

/** Seuil de bascule 10 % → 15 % (marge nette HT cumulée, en €). */
export const COMMISSION_PALIER = 4000
export const COMMISSION_TAUX_BAS = 0.10
export const COMMISSION_TAUX_HAUT = 0.15

/**
 * Commission due pour une marge nette HT cumulée donnée (barème par tranche).
 * @param margeHT marge nette HT cumulée (€). Valeurs négatives → 0.
 */
export function calcCommissionAchat(margeHT: number): number {
  if (!Number.isFinite(margeHT) || margeHT <= 0) return 0
  if (margeHT <= COMMISSION_PALIER) return Math.round(margeHT * COMMISSION_TAUX_BAS)
  const bas = COMMISSION_PALIER * COMMISSION_TAUX_BAS
  const haut = (margeHT - COMMISSION_PALIER) * COMMISSION_TAUX_HAUT
  return Math.round(bas + haut)
}

/** Taux marginal appliqué à la prochaine tranche (pour affichage). */
export function tauxMarginalCommission(margeHT: number): number {
  return margeHT > COMMISSION_PALIER ? COMMISSION_TAUX_HAUT : COMMISSION_TAUX_BAS
}
