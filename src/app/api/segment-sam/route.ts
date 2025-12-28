// app/api/segment-sam/route.ts
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

    console.log('🔄 Détourage pour:', imageUrl)

    const output = await replicate.run(
      "lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1",
      {
        input: {
          image: imageUrl
        }
      }
    )

    console.log('📦 Output Replicate:', output, typeof output)

    if (!output) {
      return NextResponse.json({ success: false, error: 'Pas de résultat Replicate' })
    }

    // Gérer différents formats de sortie
    let outputUrl: string | null = null
    
    if (typeof output === 'string') {
      outputUrl = output
    } else if (typeof output === 'object' && output !== null) {
      // Si c'est un objet avec une méthode url() ou une propriété url
      if ('url' in output && typeof (output as any).url === 'function') {
        outputUrl = await (output as any).url()
      } else if ('url' in output) {
        outputUrl = (output as any).url
      } else if (Array.isArray(output) && output.length > 0) {
        outputUrl = output[0]
      }
    }

    console.log('🔗 Output URL:', outputUrl)

    if (!outputUrl) {
      return NextResponse.json({ success: false, error: `Format inattendu: ${JSON.stringify(output)}` })
    }

    // Upload sur Cloudinary
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    const imgResponse = await fetch(outputUrl)
    const blob = await imgResponse.blob()

    const formData = new FormData()
    formData.append('file', blob, 'detoured.png')
    formData.append('upload_preset', uploadPreset!)
    formData.append('folder', 'produits')

    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: formData }
    )

    const cloudinaryData = await cloudinaryResponse.json()
    
    const baseUrl = cloudinaryData.secure_url
    const urlParts = baseUrl.split('/upload/')
    const finalUrl = urlParts.length === 2
      ? `${urlParts[0]}/upload/b_white,c_lpad,ar_1:1,w_1200,h_1200,g_center,q_auto:best/${urlParts[1]}`
      : baseUrl

    console.log('✅ URL finale:', finalUrl)

    return NextResponse.json({ 
      success: true, 
      maskUrl: finalUrl
    })

  } catch (error: any) {
    console.error('❌ Erreur détourage:', error.message)
    return NextResponse.json(
      { error: error.message || 'Erreur détourage' },
      { status: 500 }
    )
  }
}