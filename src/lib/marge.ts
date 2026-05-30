// Calcul de la marge nette affichée sur les produits et ventes (admin only).
//
// Règle (cf. memory project_marge_nette) :
//   marge_nette = (prixVente − prixAchat) × 0.80
// Les 20% retirés correspondent à la TVA. On affiche toujours la marge nette
// (jamais la brute) pour donner une vision réaliste à l'admin.
//
// Pour les pièces déposante/chineuse qui n'ont pas de `prixAchat` direct, la
// marge dépend de la rétrocession et nécessite un autre calcul — non couvert
// par ce helper, qui retourne `null` dans ce cas.

/** Part de TVA retirée pour passer de la marge brute à la marge nette. */
export const TAUX_TVA = 0.20

/**
 * Marge nette en euros (arrondie à l'entier le plus proche), ou `null` si
 * l'un des deux prix n'est pas un nombre exploitable.
 */
export function calcMargeNette(
  prixVente: number | undefined | null,
  prixAchat: number | undefined | null
): number | null {
  if (typeof prixVente !== 'number' || typeof prixAchat !== 'number') return null
  return Math.round((prixVente - prixAchat) * (1 - TAUX_TVA))
}
