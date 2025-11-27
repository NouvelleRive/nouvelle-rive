// lib/ebay/remove.ts

/**
 * Fonctions pour retirer des produits d'eBay
 */

import { ebayApiCall, isEbayConfigured } from './clients'

/**
 * Retire une offer (dépublie le listing)
 */
export async function withdrawOffer(offerId: string): Promise<boolean> {
  try {
    await ebayApiCall(`/sell/inventory/v1/offer/${offerId}/withdraw`, {
      method: 'POST',
    })
    console.log(`✅ Offer retirée: ${offerId}`)
    return true
  } catch (error: any) {
    console.error(`❌ Erreur retrait offer ${offerId}:`, error?.message)
    return false
  }
}

/**
 * Supprime un inventoryItem
 */
export async function deleteInventoryItem(sku: string): Promise<boolean> {
  try {
    await ebayApiCall(`/sell/inventory/v1/inventory_item/${sku}`, {
      method: 'DELETE',
    })
    console.log(`✅ InventoryItem supprimé: ${sku}`)
    return true
  } catch (error: any) {
    console.error(`❌ Erreur suppression inventoryItem ${sku}:`, error?.message)
    return false
  }
}

/**
 * Retire complètement un produit d'eBay (offer + inventory)
 */
export async function removeFromEbay(
  sku: string, 
  offerId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isEbayConfigured()) {
      return { success: false, error: 'eBay non configuré' }
    }

    console.log(`🗑️ Retrait eBay: SKU=${sku}, OfferId=${offerId}`)

    // 1. Retirer l'offer si on a l'ID
    if (offerId) {
      await withdrawOffer(offerId)
    }

    // 2. Supprimer l'inventoryItem
    await deleteInventoryItem(sku)

    return { success: true }

  } catch (error: any) {
    console.error('❌ Erreur retrait eBay:', error?.message)
    return { success: false, error: error?.message }
  }
}

/**
 * Met à jour la quantité sur eBay (ou retire si quantité = 0)
 */
export async function updateEbayQuantity(
  sku: string,
  newQuantity: number,
  offerId?: string
): Promise<boolean> {
  try {
    if (!isEbayConfigured()) {
      return false
    }

    if (newQuantity <= 0) {
      // Quantité 0 = retirer complètement
      const result = await removeFromEbay(sku, offerId)
      return result.success
    }

    // Mettre à jour la quantité
    await ebayApiCall(`/sell/inventory/v1/inventory_item/${sku}`, {
      method: 'PUT',
      body: {
        availability: {
          shipToLocationAvailability: {
            quantity: newQuantity,
          },
        },
      },
    })

    console.log(`✅ Quantité eBay mise à jour: ${sku} → ${newQuantity}`)
    return true

  } catch (error: any) {
    console.error(`❌ Erreur mise à jour quantité eBay ${sku}:`, error?.message)
    return false
  }
}

/**
 * Vérifie si un produit est listé sur eBay
 */
export async function isListedOnEbay(sku: string): Promise<boolean> {
  try {
    if (!isEbayConfigured()) {
      return false
    }

    await ebayApiCall(`/sell/inventory/v1/inventory_item/${sku}`, {
      method: 'GET',
    })
    
    return true
  } catch {
    return false
  }
}