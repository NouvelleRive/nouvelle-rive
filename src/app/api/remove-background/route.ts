// app/api/remove-background/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json()

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl requis' }, { status: 400 })
    }

    console.log('🔄 Détourage Replicate pour:', imageUrl)

    // Appeler le modèle rembg sur Replicate
    const output = await replicate.run(
      "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
      {
        input: {
          image: imageUrl
        }
      }
    )

    console.log('✅ Détourage terminé:', output)

    // output est l'URL de l'image détourée (fond transparent)
    // output peut être une string ou un objet
    const removedBgUrl = typeof output === 'string' 
      ? output 
      : Array.isArray(output) 
        ? output[0] 
        : (output as any)?.url || null

    console.log('✅ URL détourée:', removedBgUrl)

    return NextResponse.json({ 
      success: true, 
      removedBgUrl 
    })
    
  } catch (error: any) {
    console.error('❌ Erreur détourage:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur détourage' },
      { status: 500 }
    )
  }
}