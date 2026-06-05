// Décrémente le stock d'un produit vendu (cas Square webhook + vente familiale).
// Centralise la logique multi-quantité : décrémente de 1, ne marque vendu/outOfStock
// qu'à 0, distingue smallBatch, et nettoie les canaux externes au passage à 0.
import type { Firestore, DocumentReference, Timestamp as TimestampType } from 'firebase-admin/firestore'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { removeFromAllChannels } from '@/lib/syncRemoveFromAllChannels'

export type MarkSoldResult = {
  nouvelleQuantite: number
  ruptureStock: boolean
  isSmallBatch: boolean
}

export async function markProduitSold(
  db: Firestore,
  produitRef: DocumentReference,
  produit: any,
  opts: {
    saleTimestamp: TimestampType
    prixVenteReel: number
    trigramme?: string | null
    extraFields?: Record<string, any>
    excludeChannelOnSoldOut?: 'square' | 'ebay' | 'site'
  }
): Promise<MarkSoldResult> {
  const quantiteActuelle = Number(produit?.quantite) || 1
  const nouvelleQuantite = Math.max(0, quantiteActuelle - 1)
  const ruptureStock = nouvelleQuantite === 0

  let isSmallBatch = false
  if (ruptureStock && opts.trigramme) {
    const chSnap = await db.collection('chineuse')
      .where('trigramme', '==', opts.trigramme)
      .limit(1)
      .get()
    if (!chSnap.empty) {
      isSmallBatch = chSnap.docs[0].data().stockType === 'smallBatch'
    }
  }

  const updateData: any = {
    quantite: nouvelleQuantite,
    updatedAt: FieldValue.serverTimestamp(),
    ...(opts.extraFields || {}),
  }
  if (ruptureStock) {
    if (isSmallBatch) {
      updateData.statut = 'outOfStock'
      updateData.dateRupture = opts.saleTimestamp
    } else {
      updateData.vendu = true
      updateData.dateVente = opts.saleTimestamp
      updateData.statut = 'vendu'
    }
    updateData.prixVenteReel = opts.prixVenteReel
  }
  await produitRef.update(updateData)

  if (ruptureStock && !isSmallBatch) {
    await removeFromAllChannels(
      {
        id: produitRef.id,
        sku: produit?.sku,
        ebayOfferId: produit?.ebayOfferId,
        ebayListingId: produit?.ebayListingId,
      },
      opts.excludeChannelOnSoldOut
    ).catch(e => console.error('⚠️ Retrait multi-canal KO:', e?.message))
  }

  return { nouvelleQuantite, ruptureStock, isSmallBatch }
}
