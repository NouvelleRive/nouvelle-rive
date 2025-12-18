import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { Client, Environment } from 'square'
import { v4 as uuidv4 } from 'uuid'

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const adminDb = getFirestore()

const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  environment: Environment.Production,
})

const locationId = process.env.SQUARE_LOCATION_ID!

export async function POST(req: NextRequest) {
  try {
    const { limit = 100, dryRun = false } = await req.json().catch(() => ({}))

    // Trouver les produits reçus mais pas dans Square
    const snapshot = await adminDb.collection('produits')
      .where('recu', '==', true)
      .where('catalogObjectId', '==', null)
      .limit(limit)
      .get()

    // Si catalogObjectId n'existe pas du tout, essayer sans le filtre
    let docs = snapshot.docs
    if (docs.length === 0) {
      const snapshot2 = await adminDb.collection('produits')
        .where('recu', '==', true)
        .limit(limit)
        .get()
      
      docs = snapshot2.docs.filter(doc => {
        const data = doc.data()
        return !data.catalogObjectId && !data.variationId
      })
    }

    console.log(`📦 ${docs.length} produits à synchroniser`)

    if (docs.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Tous les produits sont déjà synchronisés',
        synced: 0,
        remaining: 0
      })
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        toSync: docs.length,
        products: docs.map(d => ({ id: d.id, sku: d.data().sku, nom: d.data().nom }))
      })
    }

    let synced = 0
    let errors = 0

    // Traiter par batch de 10 pour Square
    for (let i = 0; i < docs.length; i += 10) {
      const batch = docs.slice(i, i + 10)
      const objects: any[] = []
      const productMap = new Map<string, any>()

      for (const doc of batch) {
        const data = doc.data()
        if (!data.sku) continue

        const itemId = `#item_${data.sku}`
        const variationId = `#variation_${data.sku}`

        objects.push({
          type: 'ITEM',
          id: itemId,
          itemData: {
            name: data.nom,
            description: data.description || '',
            categoryId: typeof data.categorie === 'object' ? data.categorie?.idsquare : undefined,
            variations: [
              {
                type: 'ITEM_VARIATION',
                id: variationId,
                itemVariationData: {
                  itemId: itemId,
                  name: data.nom,
                  sku: data.sku,
                  pricingType: 'FIXED_PRICING',
                  priceMoney: {
                    amount: BigInt(Math.round((data.prix || 0) * 100)),
                    currency: 'EUR',
                  },
                  trackInventory: true,
                  locationOverrides: [
                    {
                      locationId,
                      trackInventory: true,
                    },
                  ],
                },
              },
            ],
          },
        })

        productMap.set(data.sku, { doc, data })
      }

      if (objects.length === 0) continue

      try {
        const { result } = await squareClient.catalogApi.batchUpsertCatalogObjects({
          idempotencyKey: uuidv4(),
          batches: [{ objects }],
        })

        // Mapper les IDs
        const createdItems = new Map<string, { itemId: string; variationId: string }>()

        if (result.idMappings) {
          for (const mapping of result.idMappings) {
            const clientId = mapping.clientObjectId || ''
            const realId = mapping.objectId || ''

            if (clientId.startsWith('#item_')) {
              const sku = clientId.replace('#item_', '')
              if (!createdItems.has(sku)) {
                createdItems.set(sku, { itemId: realId, variationId: '' })
              } else {
                createdItems.get(sku)!.itemId = realId
              }
            } else if (clientId.startsWith('#variation_')) {
              const sku = clientId.replace('#variation_', '')
              if (!createdItems.has(sku)) {
                createdItems.set(sku, { itemId: '', variationId: realId })
              } else {
                createdItems.get(sku)!.variationId = realId
              }
            }
          }
        }

        // Mettre à jour Firestore et inventory
        for (const [sku, ids] of createdItems) {
          const product = productMap.get(sku)
          if (!product || !ids.variationId) continue

          try {
            // Mettre à jour le stock
            await squareClient.inventoryApi.batchChangeInventory({
              idempotencyKey: uuidv4(),
              changes: [
                {
                  type: 'PHYSICAL_COUNT',
                  physicalCount: {
                    catalogObjectId: ids.variationId,
                    locationId,
                    quantity: String(product.data.quantite || 1),
                    state: 'IN_STOCK',
                    occurredAt: new Date().toISOString(),
                  },
                },
              ],
            })

            // Mettre à jour Firestore
            await product.doc.ref.update({
              catalogObjectId: ids.itemId,
              variationId: ids.variationId,
              itemId: ids.itemId,
              squareSyncedAt: FieldValue.serverTimestamp(),
            })

            synced++
            console.log(`✅ ${sku} synchronisé`)
          } catch (err: any) {
            console.error(`❌ Erreur pour ${sku}:`, err?.message)
            errors++
          }
        }

      } catch (squareError: any) {
        console.error(`❌ Erreur batch Square:`, squareError?.message)
        errors += batch.length
      }

      // Pause entre les batches pour éviter le rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Compter les restants
    const remainingSnapshot = await adminDb.collection('produits')
      .where('recu', '==', true)
      .limit(1500)
      .get()
    
    const remaining = remainingSnapshot.docs.filter(doc => {
      const data = doc.data()
      return !data.catalogObjectId && !data.variationId
    }).length

    return NextResponse.json({
      success: true,
      synced,
      errors,
      remaining,
      message: remaining > 0 ? `Relancez l'API pour synchroniser les ${remaining} produits restants` : 'Tous les produits sont synchronisés'
    })

  } catch (error: any) {
    console.error('❌ Erreur resync:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}