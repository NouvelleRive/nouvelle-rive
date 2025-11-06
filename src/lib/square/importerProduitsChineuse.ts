import { Client, Environment } from 'square'
import { adminDb } from '@/lib/firebaseAdmin'

const accessToken = process.env.SQUARE_ACCESS_TOKEN
const locationId = process.env.SQUARE_LOCATION_ID

if (!accessToken || !locationId) {
  throw new Error('SQUARE_ACCESS_TOKEN ou SQUARE_LOCATION_ID manquant dans le .env.local')
}

const client = new Client({
  accessToken,
  environment: Environment.Production,
})

export async function importerProduitsChineuse({
  nom,
  prix,
  description,
  codeBarre,
  stock,
  categorie,
  chineurNom,
}: {
  nom: string
  prix: number
  description?: string
  codeBarre?: string
  stock: number
  categorie?: string
  chineurNom: string
}) {
  console.log('➡️ DÉBUT importerProduitsChineuse')
  console.log('📥 Catégorie reçue dans la fonction:', categorie)

  let categoryIdSquare: string | undefined = undefined

  try {
    const chineuseSnap = await adminDb.collection('chineuse').doc(chineurNom).get()

    if (!chineuseSnap.exists) {
      throw new Error(`Chineuse "${chineurNom}" introuvable dans Firestore`)
    }

    const data = chineuseSnap.data() as any
    const categoriesField = data['Catégorie']

    if (Array.isArray(categoriesField) && categorie) {
      const labelPur = categorie.split(';')[0].trim()
      const match = categoriesField.find((cat: any) => cat.label === labelPur)
      if (match && match.idsquare) {
        categoryIdSquare = match.idsquare
        console.log('✅ ID catégorie Square trouvé pour :', labelPur)
      } else {
        console.warn('❌ Catégorie introuvable dans Firestore pour :', labelPur)
      }
    }

    const search = await client.catalogApi.searchCatalogObjects({
      objectTypes: ['ITEM'],
      query: { textQuery: { keywords: [nom] } }
    })

    const existing = search.result.objects?.find(obj => obj.itemData?.name === nom)

    let variationId: string | undefined
    let itemId: string | undefined
    let variationVersion: number | bigint | undefined

    if (existing) {
      console.log(`✏️ Mise à jour du produit existant ID ${existing.id}`)
      itemId = existing.id
      variationId = existing.itemData?.variations?.[0]?.id
      variationVersion = existing.itemData?.variations?.[0]?.version

      await client.catalogApi.upsertCatalogObject({
        idempotencyKey: `${codeBarre}-${Date.now()}`,
        object: {
          id: itemId,
          version: existing.version as any,
          type: 'ITEM',
          presentAtAllLocations: true,
          itemData: {
            name: nom,
            description: description || '',
            categoryId: categoryIdSquare,
            variations: [
              {
                id: variationId,
                version: variationVersion as any,
                type: 'ITEM_VARIATION',
                presentAtAllLocations: true,
                itemVariationData: {
                  itemId: itemId,
                  name: 'Prix standard',
                  pricingType: 'FIXED_PRICING',
                  priceMoney: {
                    amount: Math.round(prix * 100),
                    currency: 'EUR'
                  },
                  sku: codeBarre || undefined,
                  trackInventory: true
                },
              },
            ],
          },
        },
      })
    } else {
      const now = Date.now()
      const itemTempId = `#${nom}-${now}`
      const variationTempId = `#${nom}-variation-${now}`

      const produit = await client.catalogApi.upsertCatalogObject({
        idempotencyKey: `${now}-${Math.random()}`,
        object: {
          type: 'ITEM',
          id: itemTempId,
          presentAtAllLocations: true,
          itemData: {
            name: nom,
            description: description || '',
            categoryId: categoryIdSquare,
            variations: [
              {
                type: 'ITEM_VARIATION',
                id: variationTempId,
                presentAtAllLocations: true,
                itemVariationData: {
                  itemId: itemTempId,
                  name: 'Prix standard',
                  pricingType: 'FIXED_PRICING',
                  priceMoney: {
                    amount: Math.round(prix * 100),
                    currency: 'EUR'
                  },
                  sku: codeBarre || undefined,
                  trackInventory: true
                },
              },
            ],
          },
        },
      })

      console.log('🧾 Square result complet :', JSON.stringify(produit.result, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2))
      variationId = produit.result.catalogObject?.itemData?.variations?.[0]?.id
      itemId = produit.result.catalogObject?.id
    }

    if (!variationId) {
      throw new Error('Variation non créée ou trouvée correctement (ID manquant)')
    }

    if (typeof stock !== 'number') {
      throw new Error(`Quantité de stock non fournie ou invalide pour "${nom}"`)
    }

    const stockResult = await client.inventoryApi.batchChangeInventory({
      idempotencyKey: `${Date.now()}-${Math.random()}`,
      changes: [
        {
          type: 'PHYSICAL_COUNT',
          physicalCount: {
            catalogObjectId: variationId,
            locationId: locationId!,
            quantity: stock.toString(),
            state: 'IN_STOCK',
            adjustmentType: 'RECEIVE_STOCK',
            occurredAt: new Date().toISOString()
          }
        }
      ]
    })

    console.log('📦 Résultat Square batchChangeInventory :', JSON.stringify(stockResult, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2))

    const snap = await adminDb
      .collection('produits')
      .where('chineur', '==', chineurNom)
      .where('nom', '==', nom)
      .get()

    if (!snap.empty) {
      for (const docSnap of snap.docs) {
        await docSnap.ref.update({
          categorie,
          stock,
          description,
          codeBarre,
          prix,
          catalogObjectId: variationId, // utilisé pour matcher la vente plus tard
          variationId // 🔥 on stocke aussi la variation pour sync-ventes
        })
      }
      console.log('✏️ Firestore mis à jour')
    }

    console.log(`✅ Produit "${nom}" importé avec stock : ${stock} unités`)
    return {
  message: 'Produit créé ou mis à jour',
  variationId,
  itemId
  }
  } catch (error: any) {
    console.error('❌ Erreur lors de l’import produit + stock Square')
    console.error('🧾 Détail erreur :', error)
    try {
      const full = JSON.stringify(error, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2)
      console.error('🧾 Erreur JSON complète :', full)
    } catch (e) {
      console.warn('⚠️ Impossible d’afficher l’erreur complète en JSON')
    }
    if (error?.response?.body) {
      console.error('📩 Square response body:', JSON.stringify(error.response.body, null, 2))
    }
    throw error
  }
}
