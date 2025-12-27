// app/api/segment-sam/route.ts
// Redirige vers rembg pour le détourage
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
      "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
      {
        input: {
          image: imageUrl,
          alpha_matting: true,
          alpha_matting_foreground_threshold: 270,
          alpha_matting_background_threshold: 20,
          alpha_matting_erode_size: 15
        }
      }
    )

    if (!output) {
      return NextResponse.json({ success: false, error: 'Pas de résultat' })
    }

    // Upload sur Cloudinary
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    const imgResponse = await fetch(output as unknown as string)
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
    
    // Ajouter fond blanc
    const baseUrl = cloudinaryData.secure_url
    const urlParts = baseUrl.split('/upload/')
    const finalUrl = urlParts.length === 2
      ? `${urlParts[0]}/upload/b_white,c_pad,ar_1:1,w_1200,h_1200/${urlParts[1]}`
      : baseUrl

    console.log('✅ Détourage réussi:', finalUrl)

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