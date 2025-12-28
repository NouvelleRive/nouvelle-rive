import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, rotation = 0 } = await req.json()

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl requis' }, { status: 400 })
    }

    console.log('🔄 Détourage pour:', imageUrl, 'rotation:', rotation)

    const output = await replicate.run(
      "lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1",
      { input: { image: imageUrl } }
    )

    console.log('📦 Output:', JSON.stringify(output))

    let outputUrl: string | null = null
    
    if (typeof output === 'string') {
      outputUrl = output
    } else if (Array.isArray(output) && output.length > 0) {
      outputUrl = output[0]
    } else if (output && typeof output === 'object') {
      const obj = output as any
      outputUrl = obj.url || obj.output || obj.image || null
    }

    if (!outputUrl) {
      return NextResponse.json({ success: false, error: 'Pas de résultat de Replicate' })
    }

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
    
    const rotationTransform = rotation !== 0 ? `a_${rotation},` : ''
    
    const finalUrl = urlParts.length === 2
      ? `${urlParts[0]}/upload/${rotationTransform}b_white,c_lpad,ar_1:1,w_1200,h_1200,g_center,e_auto_brightness,e_auto_contrast,e_brightness:8,e_gamma:105,e_vibrance:20,e_sharpen:40,q_auto:best/${urlParts[1]}`
      : baseUrl

    return NextResponse.json({ success: true, maskUrl: finalUrl })

  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}