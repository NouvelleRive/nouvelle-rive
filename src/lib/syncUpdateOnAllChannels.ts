import { prepareProductForEbay, wearTypeToGender, formatEbayTitle, buildProductAspects, findEbayCategoryFromFirebase, formatEbayDescription, type EbayGender } from '@/lib/ebay'
import { ebayApiCall, calculateEbayPrice, isEbayConfigured } from '@/lib/ebay/clients'
import { getFirestore } from 'firebase-admin/firestore'

const db = getFirestore()

async function getGenderForProduct(produitData: any): Promise<EbayGender> {
  const trigramme = produitData.trigramme || produitData.sku?.match(/^([A-Z]{2,4})/i)?.[1]
  if (trigramme) {
    const chiSnap = await db.collection('chineuse').where('trigramme', '==', trigramme.toUpperCase()).limit(1).get()
    if (!chiSnap.empty) {
      const wearType = chiSnap.docs[0].data().wearType
      return wearTypeToGender(wearType) || 'women'
    }
  }
  return 'women'
}

async function updateProductOnEbay(produitData: any): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isEbayConfigured()) return { success: false, error: 'eBay non configuré' }
    if (!produitData.ebayListingId) return { success: false, error: 'Non publié sur eBay' }

    const gender = await getGenderForProduct(produitData)
    const ebayProduct = prepareProductForEbay(produitData, gender)
    const ebayCategory = findEbayCategoryFromFirebase(ebayProduct.categoryId, ebayProduct.sousCat, gender)

    await ebayApiCall(`/sell/inventory/v1/inventory_item/${ebayProduct.sku}`, {
      method: 'PUT',
      body: {
        availability: { shipToLocationAvailability: { quantity: produitData.quantite || 1 } },
        condition: 'USED_EXCELLENT',
        conditionDescription: 'Excellent vintage condition. Carefully inspected and curated from our Paris boutique.',
        product: {
          title: formatEbayTitle(ebayProduct, gender),
          description: formatEbayDescription(ebayProduct.description, ebayProduct),
          imageUrls: ebayProduct.imageUrls.slice(0, 12),
          aspects: buildProductAspects(ebayProduct, ebayCategory.type, gender),
        },
      },
    })

    if (produitData.ebayOfferId) {
      const priceUSD = calculateEbayPrice(ebayProduct.priceEUR)
      await ebayApiCall(`/sell/inventory/v1/offer/${produitData.ebayOfferId}`, {
        method: 'PUT',
        body: {
          pricingSummary: {
            price: { value: priceUSD.toString(), currency: 'USD' },
          },
        },
      })
    }

    console.log(`✅ eBay mis à jour: ${produitData.sku}`)
    return { success: true }
  } catch (error: any) {
    console.error(`⚠️ Erreur update eBay: ${error?.message}`)
    return { success: false, error: error?.message }
  }
}

export async function updateOnAllChannels(
  produitData: any,
  excludeChannel?: 'square' | 'ebay' | 'site'
): Promise<Record<string, { success: boolean; error?: string }>> {
  const publishedOn: string[] = produitData.publishedOn || []
  const results: Record<string, { success: boolean; error?: string }> = {}

  if (publishedOn.includes('ebay') && excludeChannel !== 'ebay') {
    results.ebay = await updateProductOnEbay(produitData)
  }

  // Etsy (à ajouter plus tard)
  // if (publishedOn.includes('etsy') && excludeChannel !== 'etsy') {
  //   results.etsy = await updateProductOnEtsy(produitData)
  // }

  return results
}
