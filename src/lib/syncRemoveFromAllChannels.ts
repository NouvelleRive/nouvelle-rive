// lib/syncRemoveFromAllChannels.ts

/**
 * Helper pour retirer un produit de tous les canaux de vente
 * Utilisé quand quantite = 0 (produit vendu)
 */

import { removeFromEbay, isEbayConfigured } from '@/lib/ebay'
import { adminDb } from '@/lib/firebaseAdmin'

/**
 * Retire un produit d'eBay et nettoie ebayListingId/ebayOfferId dans Firestore
 * uniquement si le retrait eBay a réussi.
 * Renvoie true si le retrait eBay s'est bien passé (ou n'avait rien à faire).
 */
export async function removeProductFromEbay(
  produitId: string,
  sku: string,
  ebayOfferId?: string
): Promise<boolean> {
  try {
    if (!isEbayConfigured()) {
      console.log('⏭️ eBay non configuré, skip retrait')
      return false
    }
    if (!sku) {
      console.log('⏭️ Pas de SKU, skip retrait eBay')
      return false
    }

    console.log(`🗑️ Retrait eBay: ${sku}`)
    const result = await removeFromEbay(sku, ebayOfferId)

    if (!result.success) {
      console.warn(`⚠️ Échec retrait eBay ${sku} : ${result.error} — Firestore non modifié`)
      return false
    }

    // Nettoie les ids eBay côté Firestore pour ne pas garder un lien fantôme.
    try {
      const snap = await adminDb.collection('produits').doc(produitId).get()
      const publishedOn = Array.isArray(snap.data()?.publishedOn) ? snap.data()!.publishedOn as string[] : []
      await adminDb.collection('produits').doc(produitId).update({
        ebayListingId: null,
        ebayOfferId: null,
        ebayPublishedAt: null,
        publishedOn: publishedOn.filter(s => s !== 'ebay'),
      })
    } catch (e: any) {
      console.warn(`⚠️ Retrait eBay OK mais maj Firestore KO pour ${produitId} : ${e?.message}`)
    }

    console.log(`✅ Produit retiré d'eBay: ${sku}`)
    return true
  } catch (error: any) {
    console.error(`⚠️ Erreur retrait eBay (non bloquant): ${error?.message}`)
    return false
  }
}

/**
 * Retire un produit de tous les canaux
 * 
 * @param produit - Le produit Firebase
 * @param excludeChannel - Canal à exclure (celui où la vente a eu lieu)
 */
export async function removeFromAllChannels(
  produit: {
    id: string
    sku?: string
    squareId?: string
    ebayOfferId?: string
    ebayListingId?: string
  },
  excludeChannel?: 'square' | 'ebay' | 'site'
): Promise<void> {
  console.log(`🔄 Retrait multi-canal pour: ${produit.id}`)

  const promises: Promise<void>[] = []

  // Retrait eBay (sauf si vente vient d'eBay)
  if (excludeChannel !== 'ebay' && (produit.ebayOfferId || produit.ebayListingId)) {
    promises.push(
      removeProductFromEbay(produit.id, produit.sku || produit.id, produit.ebayOfferId).then(() => undefined)
    )
  }

  // Note: Le retrait Square est géré par les fonctions existantes
  // (archiveOrDeleteByVariation dans tes webhooks actuels)
  // On ne le duplique pas ici

  await Promise.all(promises)

  console.log(`✅ Retrait multi-canal terminé pour: ${produit.id}`)
}