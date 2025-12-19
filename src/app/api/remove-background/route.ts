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

    const output = await replicate.run(
      "cjwbw/rembg",
      {
        input: {
          image: imageUrl
        }
      }
    )

    console.log('✅ Détourage terminé:', output)

    // Extraire l'URL
    let removedBgUrl: string | null = null
    if (typeof output === 'string') {
      removedBgUrl = output
    } else if (output && typeof output === 'object') {
      removedBgUrl = (output as any).output || (output as any).url || (output as any)[0] || null
    }

    if (!removedBgUrl) {
      console.log('⚠️ Pas d\'URL dans output:', JSON.stringify(output))
    }

    return NextResponse.json({ 
      success: true, 
      removedBgUrl 
    })

  } catch (error: any) {
    console.error('❌ Erreur détourage:', error.message)
    return NextResponse.json(
      { error: error.message || 'Erreur détourage' },
      { status: 500 }
    )
  }
}