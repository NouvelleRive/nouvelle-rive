// Calcul de la marge nette affichée sur les produits et ventes (admin only).
//
// Régime TVA sur marge (biens d'occasion, art. 297 A CGI) : la marge
// (prixVente − prixAchat) est un montant TTC, la TVA vaut marge × 20/120.
// D'où :
//   marge_nette_HT = (prixVente − prixAchat) ÷ 1,20
// On affiche toujours la marge nette HT (jamais la brute TTC) pour donner une
// vision réaliste à l'admin.
//
// Pour les pièces déposante/chineuse qui n'ont pas de `prixAchat` direct, la
// marge dépend de la rétrocession et nécessite un autre calcul — non couvert
// par ce helper, qui retourne `null` dans ce cas.

/** Taux de TVA appliqué à la marge. */
export const TAUX_TVA = 0.20

/**
 * Passe une marge brute TTC en marge nette HT (TVA sur marge).
 * Utiliser partout plutôt qu'un `× 0.80`, qui traiterait la marge comme déjà HT.
 */
export function margeTtcVersHt(margeTTC: number): number {
  return margeTTC / (1 + TAUX_TVA)
}

/**
 * Marge nette HT en euros (arrondie à l'entier le plus proche), ou `null` si
 * l'un des deux prix n'est pas un nombre exploitable.
 */
export function calcMargeNette(
  prixVente: number | undefined | null,
  prixAchat: number | undefined | null
): number | null {
  if (typeof prixVente !== 'number' || typeof prixAchat !== 'number') return null
  return Math.round(margeTtcVersHt(prixVente - prixAchat))
}

/**
 * Marge nette HT AVEC frais de port déduits, en euros. Sert pour la
 * rémunération de l'acheteuse : son coût réel inclut la livraison.
 *   marge = (prixVente − prixAchat − fraisPort) ÷ 1,20
 * `fraisPort` absent/invalide est traité comme 0.
 * ⚠️ À ne PAS utiliser pour la marge société/TVA : la livraison est exclue de
 * la base TVA (utiliser `calcMargeNette` sans le port pour ça).
 */
export function calcMargeNetteAvecPort(
  prixVente: number | undefined | null,
  prixAchat: number | undefined | null,
  fraisPort: number | undefined | null
): number | null {
  if (typeof prixVente !== 'number' || typeof prixAchat !== 'number') return null
  const port = typeof fraisPort === 'number' ? fraisPort : 0
  return Math.round(margeTtcVersHt(prixVente - prixAchat - port))
}
