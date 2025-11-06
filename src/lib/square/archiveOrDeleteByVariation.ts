import { Client, Environment } from 'square'

const accessToken = process.env.SQUARE_ACCESS_TOKEN
if (!accessToken) throw new Error('SQUARE_ACCESS_TOKEN manquant')

const client = new Client({
  accessToken,
  environment: Environment.Production,
})

/**
 * Tente d’abord de supprimer la variation.
 * En fallback, retrouve l’ITEM parent et l’archive (isArchived=true) ou le supprime.
 */
export async function archiveOrDeleteByVariation(variationId: string) {
  const safe = (obj: any) =>
    JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v)))

  // 1) Essai : delete direct la variation
  try {
    const del = await client.catalogApi.deleteCatalogObject(variationId)
    return { ok: true, action: 'delete_variation', result: safe(del.result) }
  } catch (e: any) {
    // continue en fallback
  }

  // 2) Fallback: récupérer la variation et son item parent
  try {
    const got = await client.catalogApi.retrieveCatalogObject(variationId, true)
    const variation = got.result.object
    const parentItemId = variation?.itemVariationData?.itemId

    if (!parentItemId) {
      return { ok: false, action: 'retrieve_ok_no_parent', error: 'No parent itemId' }
    }

    // soit on supprime l’item
    try {
      const delItem = await client.catalogApi.deleteCatalogObject(parentItemId)
      return { ok: true, action: 'delete_item', result: safe(delItem.result) }
    } catch (e2: any) {
      // soit on l’archive
      try {
        const parent = await client.catalogApi.retrieveCatalogObject(parentItemId)
        const latest = parent.result.object
        await client.catalogApi.upsertCatalogObject({
          idempotencyKey: `${Date.now()}-${Math.random()}`,
          object: {
            id: parentItemId,
            version: latest?.version,
            type: 'ITEM',
            presentAtAllLocations: false,
            itemData: {
              name: latest?.itemData?.name || 'Archived',
              isArchived: true,
              // on garde la/les variations existantes inchangées ici
            },
          },
        })
        return { ok: true, action: 'archive_item', itemId: parentItemId }
      } catch (e3: any) {
        return { ok: false, action: 'archive_failed', error: String(e3?.message || e3) }
      }
    }
  } catch (e: any) {
    return { ok: false, action: 'retrieve_failed', error: String(e?.message || e) }
  }
}
