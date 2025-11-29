import { Client, Environment } from 'square'
import { adminDb } from '@/lib/firebaseAdmin'
import FormData from 'form-data'
import fetch from 'node-fetch'

const accessToken = process.env.SQUARE_ACCESS_TOKEN
const locationId = process.env.SQUARE_LOCATION_ID

if (!accessToken || !locationId) {
  throw new Error('SQUARE_ACCESS_TOKEN ou SQUARE_LOCATION_ID manquant dans le .env.local')
}

const client = new Client({
  accessToken,
  environment: Environment.Production,
})

type ImportArgs = {
  nom: string
  prix: number
  description?: string
  stock: number
  categorie?: string
  reportingCategoryId?: string
  sku?: string
  marque?: string
  taille?: string
  imageUrl?: string
  imageUrls?: string[]
  chineurNom: string
}

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
 * Upload vers Square avec appel HTTP manuel en multipart/form-data
 */
async function uploadImageToSquare(
  imageUrl: string,
  itemName: string,
  itemId: string
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

/**
 * Récupère les URLs des images depuis Square à partir des imageIds
 */
async function getSquareImageUrls(imageIds: string[]): Promise<string[]> {
  if (!imageIds || imageIds.length === 0) return []
  
  try {
    const response = await client.catalogApi.batchRetrieveCatalogObjects({
      objectIds: imageIds,
    })
    
    const urls = response.result.objects
      ?.map((img: any) => img?.imageData?.url)
      .filter((url): url is string => Boolean(url)) || []
    
    console.log(`📸 Récupéré ${urls.length} image(s) depuis Square`)
    return urls
  } catch (err: any) {
    console.error('❌ Erreur récupération images Square:', err?.message)
    return []
  }
}

export async function importerProduitsChineuse(args: ImportArgs) {
  const {
    nom,
    prix,
    description,
    stock,
    categorie,
    reportingCategoryId,
    sku,
    marque,
    taille,
    imageUrl,
    imageUrls,
    chineurNom,
  } = args

  console.log('➡️ Import produit:', { nom, prix, sku, marque, taille })
  
  const imagesToUpload = Array.isArray(imageUrls) && imageUrls.length > 0 
    ? imageUrls 
    : (imageUrl ? [imageUrl] : [])

  let categoryIdSquare: string | undefined = undefined

  try {
    if (categorie && typeof categorie === 'string' && categorie.trim().length > 0) {
      categoryIdSquare = categorie.trim()
    }

    // Construction de la description enrichie (marque + taille)
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
    const finalDescription = descParts.join('\n') || ''

    // === 1) Chercher item existant ===
    const search = await client.catalogApi.searchCatalogObjects({
      objectTypes: ['ITEM'],
      query: { textQuery: { keywords: [nom] } },
    })

    const existing = search.result.objects?.find((obj: any) => obj?.itemData?.name === nom)

    let variationId: string | undefined
    let itemId: string | undefined
    const isNewItem = !existing
    const hasNewImages = imagesToUpload.length > 0
    
    // ✅ NOUVEAU : URLs des images existantes sur Square
    let existingSquareImageUrls: string[] = []

    if (existing) {
      console.log(`✏️ Mise à jour item ${existing.id}`)
      itemId = existing.id
      const itemVersion = existing.version
      variationId = existing.itemData?.variations?.[0]?.id
      const variationVersion = existing.itemData?.variations?.[0]?.version
      
      // ✅ NOUVEAU : Récupérer les images existantes depuis Square
      const existingImageIds = existing.itemData?.imageIds || []
      if (existingImageIds.length > 0) {
        existingSquareImageUrls = await getSquareImageUrls(existingImageIds as string[])
        console.log(`📸 Images existantes trouvées: ${existingSquareImageUrls.length}`)
      }

      await client.catalogApi.upsertCatalogObject({
        idempotencyKey: `${nom}-${Date.now()}`,
        object: {
          id: itemId,
          version: itemVersion,
          type: 'ITEM',
          presentAtAllLocations: true,
          itemData: {
            name: nom,
            description: finalDescription,
            categoryId: categoryIdSquare,
            reportingCategory: reportingCategoryId ? { id: reportingCategoryId } : undefined,
            variations: [
              {
                id: variationId,
                version: variationVersion,
                type: 'ITEM_VARIATION',
                presentAtAllLocations: true,
                itemVariationData: {
                  itemId: itemId,
                  name: 'Prix standard',
                  pricingType: 'FIXED_PRICING',
                  priceMoney: {
                    amount: Math.round(prix * 100),
                    currency: 'EUR',
                  },
                  sku: sku || undefined,
                  trackInventory: true,
                },
              },
            ],
          },
        } as any,
      })
    } else {
      console.log('🆕 Création item')
      
      const now = Date.now()
      const upsert = await client.catalogApi.upsertCatalogObject({
        idempotencyKey: `${now}-${Math.random()}`,
        object: {
          type: 'ITEM',
          id: `#${nom}-${now}`,
          presentAtAllLocations: true,
          itemData: {
            name: nom,
            description: finalDescription,
            categoryId: categoryIdSquare,
            reportingCategory: reportingCategoryId ? { id: reportingCategoryId } : undefined,
            variations: [
              {
                type: 'ITEM_VARIATION',
                id: `#${nom}-variation-${now}`,
                presentAtAllLocations: true,
                itemVariationData: {
                  itemId: `#${nom}-${now}`,
                  name: 'Prix standard',
                  pricingType: 'FIXED_PRICING',
                  priceMoney: {
                    amount: Math.round(prix * 100),
                    currency: 'EUR',
                  },
                  sku: sku || undefined,
                  trackInventory: true,
                },
              },
            ],
          },
        } as any,
      })
      
      variationId = upsert.result.catalogObject?.itemData?.variations?.[0]?.id
      itemId = upsert.result.catalogObject?.id
      
      console.log('✅ Item créé:', itemId)
    }

    if (!variationId || !itemId) {
      throw new Error('Item/Variation non créés')
    }

    // === 2) Upload image ===
    // Ne pas uploader d'image si c'est une mise à jour ET qu'aucune image n'est fournie
    let uploadedImageId: string | undefined = undefined
    
    if (hasNewImages && itemId) {
      // Upload seulement si des images sont fournies explicitement
      uploadedImageId = await uploadImageToSquare(imagesToUpload[0], nom, itemId)
      console.log('📸 Nouvelle image uploadée:', uploadedImageId)
    } else if (!isNewItem && !hasNewImages) {
      // Conserver l'image existante - ne rien faire
      console.log('📸 Pas de nouvelle image fournie, conservation des images existantes')
    }

    // === 3) Stock ===
    await client.inventoryApi.batchChangeInventory({
      idempotencyKey: `${Date.now()}-${Math.random()}`,
      changes: [
        {
          type: 'PHYSICAL_COUNT',
          physicalCount: {
            catalogObjectId: variationId,
            locationId: locationId!,
            quantity: stock.toString(),
            state: 'IN_STOCK',
            occurredAt: new Date().toISOString(),
          },
        },
      ],
    })

    // === 4) Firestore ===
    const snap = await adminDb
      .collection('produits')
      .where('chineur', '==', chineurNom)
      .where('nom', '==', nom)
      .get()

    if (!snap.empty) {
      for (const docSnap of snap.docs) {
        const updateData: Record<string, any> = {
          categorie,
          stock,
          description,
          prix,
          sku: sku || null,
          marque: marque || null,
          taille: taille || null,
          reportingCategoryId: reportingCategoryId || null,
          itemId,
          variationId,
          catalogObjectId: itemId,
        }
        
        // Ne mettre à jour imageId QUE si une nouvelle image a été uploadée
        if (uploadedImageId) {
          updateData.imageId = uploadedImageId
        }
        
        // ✅ NOUVEAU : Stocker les URLs des images Square dans Firestore
        if (existingSquareImageUrls.length > 0) {
          updateData.imageUrls = existingSquareImageUrls
          updateData.imageUrl = existingSquareImageUrls[0] // Image principale
          console.log(`📸 Images Square sauvegardées dans Firestore: ${existingSquareImageUrls.length}`)
        }
        
        await docSnap.ref.update(updateData)
      }
    }

    console.log(`✅ Produit "${nom}" importé`)
    
    return {
      message: 'Produit créé ou mis à jour',
      variationId,
      itemId,
      imageId: uploadedImageId,
      imageUrls: existingSquareImageUrls, // ✅ NOUVEAU : Retourner les URLs
    }
  } catch (error: any) {
    console.error('❌ ERREUR:', error?.message)
    if (error?.errors) {
      console.error('Détails:', JSON.stringify(error.errors, null, 2))
    }
    throw error
  }
}