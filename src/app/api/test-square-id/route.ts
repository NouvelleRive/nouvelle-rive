import { NextRequest, NextResponse } from 'next/server'
import { Client, Environment } from 'square'

const accessToken = process.env.SQUARE_ACCESS_TOKEN

const client = new Client({
  accessToken,
  environment: Environment.Production,
})

export async function POST(req: NextRequest) {
  try {
    const { catalogObjectId } = await req.json()

    if (!catalogObjectId) {
      return NextResponse.json({ error: 'catalogObjectId manquant' }, { status: 400 })
    }

    const response = await client.catalogApi.retrieveCatalogObject(catalogObjectId, true)

    // On transforme manuellement les BigInt pour éviter les erreurs de sérialisation
    const safeResult = JSON.parse(
      JSON.stringify(response.result, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    )

    return NextResponse.json({ result: safeResult })
  } catch (error: any) {
    console.error('❌ Erreur API test-square-id:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur inconnue' },
      { status: 500 }
    )
  }
}
