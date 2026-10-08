// Module ACHAT — types & constantes.
//
// Les pièces achetées (Vinted, Vestiaire, Drouot) vivent dans la même collection
// Firestore `produits` que les pièces déposante/chineuse. Elles sont rattachées
// à la chineuse Nouvelle Rive (trigramme `NR`), avec :
//   - `source: 'achat-vinted' | 'achat-vestiaire' | 'achat-drouot'`
//   - `prixAchat`  : montant total payé sur la plateforme (article + port + frais)
//   - `marge`      : marge admin (visible admin uniquement) — champ universel
//   - `recu`       : false à la commande, true quand la pièce est physiquement
//                    arrivée à la boutique. C'est le SEUL état du cycle d'achat.
//
// Le champ `prix` reste le prix de vente. Tant qu'il n'est pas saisi, l'UI affiche
// une suggestion grisée = `prixAchat × 2.5`.

import type { Timestamp } from 'firebase/firestore'

export type AchatProvenance = 'vinted' | 'vestiaire' | 'drouot' | 'fleek'

/** Multiplicateur appliqué au prix d'achat pour suggérer un prix de vente. */
export const PRIX_VENTE_MULTIPLICATEUR = 2.5

/**
 * Champs additionnels stockés sur un doc `produits` Firestore pour les pièces
 * issues d'un achat (Vinted/Vestiaire/Drouot). Tous optionnels — pour une pièce
 * déposante/chineuse classique aucun de ces champs n'est présent.
 *
 * `prixAchat` et `marge` ne sont PAS ici : ce sont des champs universels du
 * produit (cf. type Produit dans ProductList.tsx), utilisables aussi pour le
 * dépôt-vente, les chineuses, etc.
 */
export type AchatFields = {
  /** Plateforme source */
  achatProvenance?: AchatProvenance
  /** ID commande sur la plateforme (anti-doublon, trace) */
  achatOrderId?: string
  /** Pseudo vendeur sur la plateforme (trace) */
  achatVendeur?: string
  /** Date de la commande */
  achatDateCommande?: Timestamp
  /** Titre original de l'annonce, brut, avant retouche/correction ortho */
  achatTitreOriginal?: string
  /** Message-ID Gmail du mail source (anti-doublon parser) */
  achatGmailMessageId?: string
}

/** Un produit est-il un brouillon achat non encore arrivé en boutique ? */
export function isAchatBrouillon(p: { source?: string; recu?: boolean }): boolean {
  if (!p.source?.startsWith('achat-')) return false
  return p.recu !== true
}

/** Suggestion de prix de vente à partir du prix d'achat. */
export function suggestPrixVente(prixAchat: number): number {
  return Math.round(prixAchat * PRIX_VENTE_MULTIPLICATEUR)
}

/** Couleur de bordure par plateforme (référence visuelle marque). */
export const ACHAT_BORDER_COLOR: Record<AchatProvenance, string> = {
  vinted: '#09B1BA',
  vestiaire: '#000000',
  drouot: '#B8860B',
  fleek: '#F5C842',
}
