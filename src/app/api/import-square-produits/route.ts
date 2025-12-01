// app/api/import-square-produits-batch/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { Client, Environment } from 'square'
import { v4 as uuidv4 } from 'uuid'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Production,
})

const locationId = process.env.SQUARE_LOCATION_ID!

type ProduitImport = {
  productId?: string
  nom: string
  prix: number
  description?: string
  categorie?: string
  reportingCategoryId?: string
  stock?: number
  sku?: string
  marque?: string
  taille?: string
  imageUrl?: string
}

export async function POST(req: NextRequest) {
  try {
    const { produits, chineurNom, chineurEmail } = await req.json()

    if (!produits || !Array.isArray(produits) || produits.length === 0) {
      return NextResponse.json({ error: 'produits requis (array)' }, { status: 400 })
    }

    if (produits.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 produits par batch' }, { status: 400 })
    }

    // Auth
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    let decoded
    try {
      decoded = await adminAuth.verifyIdToken(token)
    } catch {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
    }

    console.log(`📦 Import batch: ${produits.length} produits pour ${chineurNom}`)

    // Construire les objets Square pour batchUpsert
    const batches: any[] = []
    const idempotencyKey = uuidv4()

    for (const p of produits as ProduitImport[]) {
      const itemId = `#item_${p.sku || uuidv4()}`
      const variationId = `#variation_${p.sku || uuidv4()}`

      const itemData: any = {
        type: 'ITEM',
        id: itemId,
        itemData: {
          name: p.nom,
          description: p.description || '',
          categoryId: p.categorie || undefined,
          reportingCategory: p.reportingCategoryId ? { id: p.reportingCategoryId } : undefined,
          variations: [
            {
              type: 'ITEM_VARIATION',
              id: variationId,
              itemVariationData: {
                itemId: itemId,
                name: p.nom,
                sku: p.sku || undefined,
                pricingType: 'FIXED_PRICING',
                priceMoney: {
                  amount: BigInt(Math.round(p.prix * 100)),
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
      }

      batches.push(itemData)
    }

    // Square batch upsert (max 1000 objets)
    let upsertResult: any = null
    const createdItems: Map<string, { itemId: string; variationId: string }> = new Map()

    try {
      const { result } = await squareClient.catalogApi.batchUpsertCatalogObjects({
        idempotencyKey,
        batches: [{ objects: batches }],
      })
      upsertResult = result

      // Mapper les IDs temporaires vers les vrais IDs
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
    } catch (squareError: any) {
      console.error('❌ Square batch upsert error:', squareError?.message)
      return NextResponse.json({ 
        error: 'Erreur Square batch', 
        details: squareError?.message 
      }, { status: 500 })
    }

    // Batch update inventory
    const inventoryChanges: any[] = []
    for (const p of produits as ProduitImport[]) {
      const ids = createdItems.get(p.sku || '')
      if (ids?.variationId && p.stock !== undefined) {
        inventoryChanges.push({
          type: 'PHYSICAL_COUNT',
          physicalCount: {
            catalogObjectId: ids.variationId,
            locationId,
            quantity: String(p.stock),
            state: 'IN_STOCK',
            occurredAt: new Date().toISOString(),
          },
        })
      }
    }

    if (inventoryChanges.length > 0) {
      try {
        await squareClient.inventoryApi.batchChangeInventory({
          idempotencyKey: uuidv4(),
          changes: inventoryChanges,
        })
      } catch (invError: any) {
        console.warn('⚠️ Inventory batch error:', invError?.message)
      }
    }

    // Batch update Firestore
    const firestoreBatch = adminDb.batch()
    const results: any[] = []

    for (const p of produits as ProduitImport[]) {
      const ids = createdItems.get(p.sku || '')
      
      if (p.productId && ids) {
        const ref = adminDb.collection('produits').doc(String(p.productId))
        firestoreBatch.update(ref, {
          catalogObjectId: ids.itemId,
          variationId: ids.variationId,
          itemId: ids.itemId,
          sku: p.sku,
          updatedAt: FieldValue.serverTimestamp(),
        })
      }

      results.push({
        sku: p.sku,
        nom: p.nom,
        itemId: ids?.itemId,
        variationId: ids?.variationId,
        success: !!ids?.itemId,
      })
    }

    await firestoreBatch.commit()

    console.log(`✅ Import batch terminé: ${results.filter(r => r.success).length}/${produits.length} réussis`)

    return NextResponse.json({
      success: true,
      count: produits.length,
      created: results.filter(r => r.success).length,
      results,
    })

  } catch (e: any) {
    console.error('❌ [API IMPORT BATCH]', e?.message)
    return NextResponse.json({ error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}