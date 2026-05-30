// Convertit le résultat d'un parser (Vinted/Vestiaire/Drouot) en payload prêt
// à écrire dans la collection Firestore `produits`.
//
// Fonction PURE : aucune dépendance Firebase. Le caller (Apps Script /
// Firebase Function / route API) est responsable de :
//   - lui passer la chineuse NR (uid + email) et le SKU à utiliser
//   - convertir les Date JS en Timestamp Firestore au moment du write
//   - utiliser un ID de doc déterministe (cf. vintedDocId du parser) pour la dédup

import type { VintedReceipt } from './parser/vinted'
import type { AchatStatut } from './types'

export type ChineuseNR = {
  /** UID Firebase Auth de la chineuse Nouvelle Rive */
  uid: string
  /** Email associé à cette chineuse */
  email: string
}

export type BuildVintedPayloadOpts = {
  /** Chineuse NR (trigramme = "NR"), à laquelle on rattache la pièce */
  chineuseNR: ChineuseNR
  /** SKU à attribuer — calculé en amont (max(NR{n}) + 1) */
  sku: string
}

/**
 * Payload destiné à `produits/{vintedDocId}`. Les dates sont en `Date` JS,
 * à convertir en `Timestamp` au moment de l'écriture Firestore.
 *
 * `prix` est volontairement absent : le prix de vente n'est pas défini à
 * l'import. L'UI affichera une suggestion grisée = `prixAchat × 2.5` tant
 * que le champ n'est pas rempli côté admin.
 *
 * `marge` est également absent à l'import — il sera calculé/saisi plus tard
 * (visible admin uniquement).
 */
export type VintedProduitPayload = {
  // ---- champs Produit standards ----
  nom: string
  description: string
  categorie: string
  marque: string
  taille: string
  sku: string
  trigramme: 'NR'
  chineurUid: string
  chineur: string
  imageUrls: string[]
  imageUrl: string
  photosReady: false
  vendu: false
  recu: false
  quantite: 1
  createdAt: Date

  // ---- champs prix / marge (universels) ----
  /** Montant total payé sur la plateforme (article + port + frais protection) */
  prixAchat: number
  // `prix` (prix de vente) non défini — l'UI suggère prixAchat × 2.5 en grisé
  // `marge` non défini — admin only, à saisir/calculer plus tard

  // ---- champs Achat ----
  source: 'achat-vinted'
  achatProvenance: 'vinted'
  achatStatut: AchatStatut
  achatOrderId: string
  achatVendeur: string
  achatDateCommande: Date
  achatTitreOriginal: string
}

/**
 * Construit le payload Firestore d'une pièce achetée sur Vinted à partir d'un
 * mail "Ton reçu" parsé. À l'import, le statut est `commande` (rien d'expédié
 * encore) et la pièce n'est pas reçue (`recu: false`).
 */
export function buildVintedProduitPayload(
  receipt: VintedReceipt,
  opts: BuildVintedPayloadOpts
): VintedProduitPayload {
  const { chineuseNR, sku } = opts
  return {
    nom: `${sku} - ${receipt.titre}`,
    description: '',
    categorie: '',
    marque: '',
    taille: '',
    sku,
    trigramme: 'NR',
    chineurUid: chineuseNR.uid,
    chineur: chineuseNR.email,
    imageUrls: [],
    imageUrl: '',
    photosReady: false,
    vendu: false,
    recu: false,
    quantite: 1,
    createdAt: new Date(),

    prixAchat: receipt.prixTotal,

    source: 'achat-vinted',
    achatProvenance: 'vinted',
    achatStatut: 'commande',
    achatOrderId: receipt.transactionId,
    achatVendeur: receipt.vendeur,
    achatDateCommande: receipt.dateAchat,
    achatTitreOriginal: receipt.titre,
  }
}
