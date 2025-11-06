import { Client, Environment } from 'square'

const env =
  process.env.SQUARE_ENV === 'production'
    ? Environment.Production
    : Environment.Sandbox

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  environment: env,
})

/**
 * Supprime un objet du catalogue Square (item OU variation) par son ID.
 */
export async function deleteCatalogObjectById(objectId: string) {
  const res = await client.catalogApi.deleteCatalogObject(objectId)
  return res.result
}
