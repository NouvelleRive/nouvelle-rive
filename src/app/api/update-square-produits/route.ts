// app/api/update-square-produits/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { Client, Environment } from 'square'
import { randomUUID } from 'crypto'
import FormData from 'form-data'
import fetch from 'node-fetch'

/**
 * Télécharge une image depuis Cloudinary
 */
async function downloadImageAsBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Échec téléchargement: ${response.status}`)
  }
  
  return await response.buffer()
}

/**
 * Upload image vers Square avec appel HTTP manuel
 */
async function uploadImageToSquare(
  imageUrl: string,
  itemName: string,
  itemId: string,
  accessToken: string
): Promise<string | undefined> {
  try {
    const imageBuffer = await downloadImageAsBuffer(imageUrl)
    
    const formData = new FormData()
    
    formData.append('file', imageBuffer, {
      filename: 'product.jpg',
      contentType: 'image/jpeg',
    })
    
    const metadata = {
      idempotency_key: `img-${itemId}-${Date.now()}`,
      object_id: itemId,
      image: {
        type: 'IMAGE',
        id: `#image-${Date.now()}`,
        image_data: {
          caption: itemName,
        },
      },
    }
    
    formData.append('request', JSON.stringify(metadata), {
      contentType: 'application/json',
    })
    
    const response = await fetch('https://connect.squareup.com/v2/catalog/images', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Square-Version': '2023-09-25',
        ...formData.getHeaders(),
      },
      body: formData,
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Erreur Square image ${response.status}:`, errorText)
      return undefined
    }
    
    const result = await response.json()
    return result?.image?.id
  } catch (err: any) {
    console.error('❌ Erreur upload image:', err?.message)
    return undefined
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      itemId: rawItemId,
      variationId: rawVariationId,
      nom,
      description,
      prix,
      sku,
      marque,
      taille,  // ✅ NOUVEAU
      categoryId,
      reportingCategoryId,
      imageUrl,
      imageUrls,
      stock,
    } = await req.json()

    console.log('📥 UPDATE produit:', { 
      itemId: rawItemId, 
      nom, 
      marque, 
      taille,  // ✅ NOUVEAU
      hasImages: imageUrls?.length || (imageUrl ? 1 : 0) 
    })

    const accessToken = process.env.SQUARE_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({ success: false, error: 'SQUARE_ACCESS_TOKEN manquant' }, { status: 500 })
    }
    const locationId = process.env.SQUARE_LOCATION_ID
    if (!locationId) {
      return NextResponse.json({ success: false, error: 'SQUARE_LOCATION_ID manquant' }, { status: 500 })
    }

    const env =
      (process.env.SQUARE_ENV || '').toLowerCase() === 'production'
        ? Environment.Production
        : Environment.Sandbox
    const client = new Client({ accessToken, environment: env })

    const amount = typeof prix === 'number' ? Math.max(0, Math.round(prix * 100)) : undefined

    const retrieve = async (id: string) => {
      const r = await client.catalogApi.retrieveCatalogObject(id, true)
      return r.result
    }

    const resolveVariation = async () => {
      if (rawVariationId) {
        try {
          const r = await retrieve(String(rawVariationId))
          const obj = r.object
          if (obj?.type === 'ITEM_VARIATION' && obj.itemVariationData?.itemId) {
            const itemId = obj.itemVariationData.itemId
            const relItem = (r.relatedObjects || []).find((o) => o.type === 'ITEM' && o.id === itemId)
            return {
              variationId: obj.id!,
              variationVersion: obj.version as any,
              itemId,
              itemVersion: relItem?.version as any,
              varName: obj.itemVariationData.name || 'Default',
            }
          }
          if (obj?.type === 'ITEM') {
            const relVar = (r.relatedObjects || []).find(
              (o) => o.type === 'ITEM_VARIATION' && o.itemVariationData?.itemId === obj.id
            )
            if (relVar?.id) {
              return {
                variationId: relVar.id,
                variationVersion: relVar.version as any,
                itemId: obj.id!,
                itemVersion: obj.version as any,
                varName: relVar.itemVariationData?.name || 'Default',
              }
            }
            throw new Error('ITEM trouvé mais aucune variation liée.')
          }
        } catch {
          // on tentera avec itemId ensuite
        }
      }

      if (rawItemId) {
        const r = await retrieve(String(rawItemId))
        const obj = r.object
        if (obj?.type !== 'ITEM') throw new Error('itemId fourni mais non-ITEM sur Square.')
        const relVar = (r.relatedObjects || []).find(
          (o) => o.type === 'ITEM_VARIATION' && o.itemVariationData?.itemId === obj.id
        )
        if (relVar?.id) {
          return {
            variationId: relVar.id,
            variationVersion: relVar.version as any,
            itemId: obj.id!,
            itemVersion: obj.version as any,
            varName: relVar.itemVariationData?.name || 'Default',
          }
        }
        throw new Error('ITEM sans variation : mise à jour impossible.')
      }

      throw new Error('Aucun identifiant Square exploitable (variationId/itemId manquant).')
    }

    const { variationId, variationVersion, itemId, itemVersion, varName } = await resolveVariation()

    // === 1) Construction de la description enrichie ===
    // Square n'a pas de champs natifs pour marque/taille, on les ajoute à la description
    const descParts: string[] = []
    if (marque && marque.trim()) {
      descParts.push(`Marque: ${marque.trim()}`)
    }
    if (taille && taille.trim()) {
      descParts.push(`Taille: ${taille.trim()}`)
    }
    if (description && description.trim()) {
      descParts.push(description.trim())
    }
    const finalDescription = descParts.join('\n') || undefined

    // === 2) Upsert ITEM + VARIATION ===
    const itemObject: any = {
      id: String(itemId),
      type: 'ITEM',
      version: itemVersion as any,
      presentAtAllLocations: true,
      itemData: {
        name: typeof nom === 'string' ? nom : undefined,
        description: finalDescription,
        categoryId: categoryId ? String(categoryId) : undefined,
        reportingCategory: reportingCategoryId ? { id: String(reportingCategoryId) } : undefined,
        variations: [
          {
            id: String(variationId),
            type: 'ITEM_VARIATION',
            version: variationVersion as any,
            presentAtAllLocations: true,
            itemVariationData: {
              itemId: String(itemId),
              name: varName || 'Default',
              pricingType: amount !== undefined ? 'FIXED_PRICING' : undefined,
              priceMoney: amount !== undefined ? { amount: BigInt(amount), currency: 'EUR' } : undefined,
              sku: typeof sku === 'string' ? sku : undefined,
            },
          },
        ],
      },
    }

    await client.catalogApi.upsertCatalogObject({
      idempotencyKey: randomUUID(),
      object: itemObject,
    })

    // === 3) Upload image vers Square ===
    const imagesToUpload = Array.isArray(imageUrls) && imageUrls.length > 0 
      ? imageUrls 
      : (imageUrl ? [imageUrl] : [])

    let uploadedImageId: string | undefined = undefined

    if (imagesToUpload.length > 0) {
      uploadedImageId = await uploadImageToSquare(
        imagesToUpload[0],
        nom || 'Produit',
        itemId,
        accessToken
      )
    }

    // === 4) Stock absolu sur la VARIATION ===
    if (typeof stock === 'number') {
      await client.inventoryApi.batchChangeInventory({
        idempotencyKey: randomUUID(),
        changes: [
          {
            type: 'PHYSICAL_COUNT',
            physicalCount: {
              referenceId: randomUUID(),
              catalogObjectId: String(variationId),
              state: 'IN_STOCK',
              locationId,
              quantity: String(Math.max(0, stock)),
              occurredAt: new Date().toISOString(),
            } as any,
          },
        ],
        ignoreUnchangedCounts: true,
      })
    }

    console.log('✅ Square mis à jour:', { itemId, variationId, marque, taille, imageId: uploadedImageId })
    
    return NextResponse.json({ 
      success: true, 
      itemId, 
      variationId,
      imageId: uploadedImageId,
    })
  } catch (e: any) {
    const msg = e?.message || 'Erreur serveur'
    let details: any = undefined
    if (e?.response?.body) { 
      try { details = e.response.body } catch {} 
    }
    console.error('❌ [update-square-produits]', msg)
    return NextResponse.json({ success: false, error: msg, details }, { status: 500 })
  }
}