// app/api/update-square-produit/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { Client, Environment } from 'square'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const {
      itemId: rawItemId,
      variationId: rawVariationId, // peut être une vraie variation OU un itemId/catId par erreur
      nom,          // optionnel (on ne touche pas à l'ITEM ici)
      description,  // optionnel
      prix,         // optionnel
      codeBarre,    // optionnel -> sku
      // ❌ on ignore categorie ici pour NE PAS casser la catégorie existante
      stock,        // optionnel (stock absolu)
    } = await req.json()

    const accessToken = process.env.SQUARE_ACCESS_TOKEN
    if (!accessToken) return NextResponse.json({ success: false, error: 'SQUARE_ACCESS_TOKEN manquant' }, { status: 500 })
    const locationId = process.env.SQUARE_LOCATION_ID
    if (!locationId) return NextResponse.json({ success: false, error: 'SQUARE_LOCATION_ID manquant' }, { status: 500 })

    const env =
      (process.env.SQUARE_ENV || '').toLowerCase() === 'production'
        ? Environment.Production
        : Environment.Sandbox
    const client = new Client({ accessToken, environment: env })

    const amount = typeof prix === 'number' ? Math.max(0, Math.round(prix * 100)) : undefined

    // -- Helpers
    const retrieve = async (id: string) => {
      const r = await client.catalogApi.retrieveCatalogObject(id, true)
      return r.result
    }

    // Résoudre une vraie variation à partir de ce qu’on a (variationId/catObjId/itemId)
    const resolveVariation = async () => {
      // 1) Si on nous passe quelque chose en variationId
      if (rawVariationId) {
        try {
          const r = await retrieve(String(rawVariationId))
          const obj = r.object
          if (obj?.type === 'ITEM_VARIATION' && obj.itemVariationData?.itemId) {
            return {
              variationId: obj.id!,
              itemId: obj.itemVariationData.itemId,
              varName: obj.itemVariationData.name || 'Default',
            }
          }
          if (obj?.type === 'ITEM') {
            const rel = (r.relatedObjects || []).find(
              (o) => o.type === 'ITEM_VARIATION' && o.itemVariationData?.itemId === obj.id
            )
            if (rel?.id) {
              return {
                variationId: rel.id,
                itemId: obj.id!,
                varName: rel.itemVariationData?.name || 'Default',
              }
            }
            // pas de variation → on ne crée pas ici (on ne modifie pas la structure)
            throw new Error('ITEM trouvé mais aucune variation liée.')
          }
        } catch {
          // on tentera avec itemId ensuite
        }
      }

      // 2) Si on nous passe un itemId
      if (rawItemId) {
        const r = await retrieve(String(rawItemId))
        const obj = r.object
        if (obj?.type !== 'ITEM') throw new Error('itemId fourni mais non-ITEM sur Square.')
        const rel = (r.relatedObjects || []).find(
          (o) => o.type === 'ITEM_VARIATION' && o.itemVariationData?.itemId === obj.id
        )
        if (rel?.id) {
          return {
            variationId: rel.id,
            itemId: obj.id!,
            varName: rel.itemVariationData?.name || 'Default',
          }
        }
        throw new Error('ITEM sans variation : mise à jour impossible sans création (non effectuée ici).')
      }

      throw new Error('Aucun identifiant Square exploitable (variationId/itemId manquant).')
    }

    const { variationId, itemId, varName } = await resolveVariation()

    // 1) Upsert de la VARIATION uniquement (ne touche pas à la catégorie/ITEM)
    if (amount !== undefined || codeBarre) {
      await client.catalogApi.upsertCatalogObject({
        idempotencyKey: randomUUID(),
        object: {
          id: String(variationId),
          type: 'ITEM_VARIATION',
          itemVariationData: {
            itemId: String(itemId),
            name: varName || 'Default',
            pricingType: amount !== undefined ? 'FIXED_PRICING' : undefined,
            priceMoney: amount !== undefined ? { amount: BigInt(amount), currency: 'EUR' } : undefined,
            sku: codeBarre ? String(codeBarre) : undefined,
          },
        } as any,
      })
    }

    // 2) Stock absolu sur la VARIATION
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

    return NextResponse.json({ success: true, itemId, variationId })
  } catch (e: any) {
    const msg = e?.message || 'Erreur serveur'
    let details: any = undefined
    if (e?.response?.body) { try { details = e.response.body } catch {} }
    console.error('❌ [update-square-produit]', msg, details || '')
    return NextResponse.json({ success: false, error: msg, details }, { status: 500 })
  }
}
