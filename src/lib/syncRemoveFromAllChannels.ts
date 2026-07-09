// lib/syncRemoveFromAllChannels.ts

/**
 * Helper pour retirer un produit de tous les canaux de vente
 * Utilisé quand quantite = 0 (produit vendu)
 */

import { Client, Environment } from 'square'
import { FieldValue as FirestoreFieldValue } from 'firebase-admin/firestore'
import { removeFromEbay, isEbayConfigured } from '@/lib/ebay'
import { adminDb } from '@/lib/firebaseAdmin'

const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN || '',
  environment: process.env.SQUARE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
})

/**
 * Supprime variation + item du catalogue Square. Si le delete de l'item échoue,
 * tente un archivage (isArchived=true) comme fallback. Idempotent : ignore les
 * 404 (l'objet a déjà été supprimé).
 */
export async function removeProductFromSquare(
  produit: { id: string; variationId?: string; catalogObjectId?: string; itemId?: string; sku?: string }
): Promise<boolean> {
  if (!process.env.SQUARE_ACCESS_TOKEN) {
    console.log('⏭️ SQUARE_ACCESS_TOKEN absent, skip retrait Square')
    return false
  }

  // Si les IDs ne sont pas passés, on les récupère depuis Firestore pour éviter
  // de devoir mettre à jour chaque caller.
  let variationId = produit.variationId || produit.catalogObjectId
  let itemId = produit.itemId
  if (!variationId && !itemId) {
    try {
      const snap = await adminDb.collection('produits').doc(produit.id).get()
      const data = snap.data() || {}
      variationId = (data.variationId || data.catalogObjectId) as string | undefined
      itemId = data.itemId as string | undefined
    } catch (err: any) {
      console.warn(`⚠️ Lecture Firestore pour IDs Square échouée: ${err?.message}`)
    }
  }
  if (!variationId && !itemId) {
    console.log(`⏭️ Pas d'IDs Square pour ${produit.id} — skip`)
    return false
  }

  let ok = true
  let variationDone = false
  let itemDone = false
  if (variationId) {
    try {
      await squareClient.catalogApi.deleteCatalogObject(variationId)
      console.log(`✅ Variation Square supprimée: ${variationId}`)
      variationDone = true
    } catch (err: any) {
      const status = err?.statusCode
      if (status === 404) {
        console.log(`ℹ️ Variation Square déjà absente: ${variationId}`)
        variationDone = true
      } else {
        console.warn(`⚠️ Suppression variation Square échouée: ${err?.message}`)
        ok = false
      }
    }
  }
  if (itemId) {
    try {
      await squareClient.catalogApi.deleteCatalogObject(itemId)
      console.log(`✅ Item Square supprimé: ${itemId}`)
      itemDone = true
    } catch (err: any) {
      const status = err?.statusCode
      if (status === 404) {
        console.log(`ℹ️ Item Square déjà absent: ${itemId}`)
        itemDone = true
      } else {
        console.warn(`⚠️ Suppression item Square échouée: ${err?.message} — tentative d'archivage`)
        try {
          const { result } = await squareClient.catalogApi.retrieveCatalogObject(itemId)
          const item = result.object
          if (item?.itemData) {
            await squareClient.catalogApi.upsertCatalogObject({
              idempotencyKey: `archive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              object: {
                id: itemId,
                type: 'ITEM',
                version: item.version,
                presentAtAllLocations: false,
                itemData: {
                  name: item.itemData.name || 'Archived',
                  description: item.itemData.description,
                  categoryId: item.itemData.categoryId,
                  variations: item.itemData.variations,
                  productType: item.itemData.productType,
                  isArchived: true,
                },
              },
            })
            console.log(`✅ Item Square archivé: ${itemId}`)
            itemDone = true
          }
        } catch (archiveErr: any) {
          console.error(`❌ Archivage Square échoué: ${archiveErr?.message}`)
          ok = false
        }
      }
    }
  }

  // Nettoyer les IDs Square côté Firestore quand la suppression a réussi (ou 404).
  // Sinon on garde les IDs pour que le cron de réconciliation puisse retenter.
  try {
    const cleanup: Record<string, unknown> = {}
    if (variationDone) {
      cleanup.variationId = FirestoreFieldValue.delete()
      cleanup.catalogObjectId = FirestoreFieldValue.delete()
    }
    if (itemDone) {
      cleanup.itemId = FirestoreFieldValue.delete()
    }
    if (ok) {
      cleanup.squareRemovalPendingAt = FirestoreFieldValue.delete()
    } else {
      cleanup.squareRemovalPendingAt = FirestoreFieldValue.serverTimestamp()
    }
    if (Object.keys(cleanup).length > 0) {
      await adminDb.collection('produits').doc(produit.id).update(cleanup)
    }
  } catch (fsErr: any) {
    console.warn(`⚠️ Nettoyage IDs Square côté Firestore KO pour ${produit.id}: ${fsErr?.message}`)
  }

  return ok
}

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
    variationId?: string
    catalogObjectId?: string
    itemId?: string
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

  // Retrait Square (sauf si vente vient de Square caisse, où le webhook a déjà supprimé l'objet).
  // Si les IDs Square ne sont pas passés, removeProductFromSquare les lit depuis Firestore.
  if (excludeChannel !== 'square') {
    promises.push(
      removeProductFromSquare(produit).then(() => undefined)
    )
  }

  await Promise.all(promises)

  console.log(`✅ Retrait multi-canal terminé pour: ${produit.id}`)
}