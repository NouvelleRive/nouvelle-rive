// Module ACHAT — types & constantes.
//
// Les pièces achetées (Vinted, Vestiaire, Drouot) vivent dans la même collection
// Firestore `produits` que les pièces déposante/chineuse. Elles sont rattachées
// à la chineuse Nouvelle Rive (trigramme `NR`), avec :
//   - `source: 'achat-vinted' | 'achat-vestiaire' | 'achat-drouot'`
//   - `prixAchat`  : montant total payé sur la plateforme (article + port + frais)
//   - `marge`      : marge admin (visible admin uniquement) — champ universel
//   - `achatStatut`: statut du cycle de vie de la commande
//   - `recu`       : true uniquement quand la pièce est physiquement à la boutique
//
// Le champ `prix` reste le prix de vente. Tant qu'il n'est pas saisi, l'UI affiche
// une suggestion grisée = `prixAchat × 2.5`.

import type { Timestamp } from 'firebase/firestore'

export type AchatProvenance = 'vinted' | 'vestiaire' | 'drouot'

/**
 * Cycle de vie d'une pièce achetée :
 *
 * - `commande`     : mail "achat confirmé" reçu, en attente d'expédition vendeur
 * - `expedie`      : mail "colis expédié" reçu
 * - `livre`        : mail "colis livré" reçu (la plateforme considère la pièce
 *                    reçue côté logistique, mais pas encore à la boutique NR)
 * - `recu-boutique`: pièce physiquement arrivée à la boutique → en parallèle
 *                    `recu: true` est posé pour intégrer la pièce au stock normal
 * - `non-conforme` : reçue mais défectueuse, remboursement demandé → brouillon annulé
 * - `jamais-recu`  : pièce jamais arrivée, remboursement Vinted → brouillon annulé
 * - `perso`        : pièce gardée par NR pour usage perso, ne pas mettre en vente
 */
export type AchatStatut =
  | 'commande'
  | 'expedie'
  | 'livre'
  | 'recu-boutique'
  | 'non-conforme'
  | 'jamais-recu'
  | 'perso'

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
  /** Statut du cycle de vie (voir AchatStatut) */
  achatStatut?: AchatStatut
  /** ID commande sur la plateforme (anti-doublon, trace) */
  achatOrderId?: string
  /** Pseudo vendeur sur la plateforme (trace) */
  achatVendeur?: string
  /** Date de la commande */
  achatDateCommande?: Timestamp
  /** Titre original de l'annonce, brut, avant retouche/correction ortho */
  achatTitreOriginal?: string
  /** Numéro de suivi transporteur (Chronopost, Mondial Relay, Colissimo…) —
   *  extrait du mail "Colis expédié / en chemin". Sert ensuite à matcher le
   *  mail "Colis disponible" du transporteur avec le bon achat. */
  achatNumeroSuivi?: string
  /** Identifiant interne du transporteur (chronopost, mondial-relay, colissimo…) */
  achatTransporteur?: string
  /** Lieu de livraison (point relais ou adresse) — extrait du mail "Colis livré".
   *  Affiché dans l'encart Livraison pour éviter de re-consulter la plateforme. */
  achatLieuLivraison?: string
  /** Code de retrait en point relais (Mondial Relay, Pickup…) */
  achatCodeRetrait?: string
  /** Date à laquelle la pièce a été marquée "livrée" (mail transporteur dispo) */
  achatDateLivraison?: Timestamp
  /** Date limite de retrait en point relais (format JJ/MM, sans année) */
  achatDateLimiteRetrait?: string
  /** Message-ID Gmail du mail source (anti-doublon parser) */
  achatGmailMessageId?: string
}

/** Libellé d'affichage du transporteur (depuis l'id interne stocké). */
export function libelleTransporteur(id: string | undefined): string {
  if (!id) return ''
  switch (id) {
    case 'chronopost': return 'Chronopost'
    case 'mondial-relay': return 'Mondial Relay'
    case 'colissimo': return 'Colissimo'
    case 'pickup': return 'Pickup'
    default: return id
  }
}

/** Libellé court d'un statut, pour affichage UI (remplace l'ancien "En attente"). */
export function libelleAchatStatut(s: AchatStatut): string {
  switch (s) {
    case 'commande': return 'Commandé'
    case 'expedie': return 'Expédié'
    case 'livre': return 'Livré'
    case 'recu-boutique': return 'Reçu boutique'
    case 'non-conforme': return 'Non conforme'
    case 'jamais-recu': return 'Jamais reçu'
    case 'perso': return 'Perso'
  }
}

/** Un produit est-il un brouillon achat non encore arrivé en boutique ? */
export function isAchatBrouillon(p: { source?: string; achatStatut?: AchatStatut }): boolean {
  if (!p.source?.startsWith('achat-')) return false
  return p.achatStatut !== 'recu-boutique'
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
}
