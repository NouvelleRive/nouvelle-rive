// lib/syncRemoveFromAllChannels.ts

/**
 * Helper pour retirer un produit de tous les canaux de vente
 * Utilisé quand quantite = 0 (produit vendu)
 */

import { removeFromEbay, isEbayConfigured } from '@/lib/ebay'

/**
 * Retire un produit d'eBay (si configuré et si listé)
 */
export async function removeProductFromEbay(
  sku: string,
  ebayOfferId?: string
): Promise<void> {
  try {
    if (!isEbayConfigured()) {
      console.log('⏭️ eBay non configuré, skip retrait')
      return
    }

    if (!sku) {
      console.log('⏭️ Pas de SKU, skip retrait eBay')
      return
    }

    console.log(`🗑️ Retrait eBay: ${sku}`)
    const result = await removeFromEbay(sku, ebayOfferId)
    
    if (result.success) {
      console.log(`✅ Produit retiré d'eBay: ${sku}`)
    } else {
      console.log(`⚠️ Échec retrait eBay (peut-être pas listé): ${result.error}`)
    }
  } catch (error: any) {
    // Non bloquant - on continue même si eBay échoue
    console.error(`⚠️ Erreur retrait eBay (non bloquant): ${error?.message}`)
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
      removeProductFromEbay(produit.sku || produit.id, produit.ebayOfferId)
    )
  }

  // Note: Le retrait Square est géré par les fonctions existantes
  // (archiveOrDeleteByVariation dans tes webhooks actuels)
  // On ne le duplique pas ici

  await Promise.all(promises)

  console.log(`✅ Retrait multi-canal terminé pour: ${produit.id}`)
}