import { Client, Environment } from 'square'

async function main() {
  const client = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment: Environment.Production,
  })

  try {
    const response = await client.catalogApi.searchCatalogObjects({
      objectTypes: ['CUSTOM_ATTRIBUTE_DEFINITION'],
      limit: 100,
    })
    console.log('Réponse complète:', JSON.stringify(response.result, null, 2))
  } catch (error) {
    console.error('Erreur récupération custom attributes:', error)
  }
}

main()
