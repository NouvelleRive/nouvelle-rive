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

    console.log('🔄 Détourage 851-labs pour:', imageUrl)

    const output = await replicate.run(
      "851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4a9c7cf8e1c7f3fc9e8e8",
      {
        input: {
          image: imageUrl
        }
      }
    )

    if (!output) {
      return NextResponse.json({ success: false, error: 'Pas de résultat' })
    }

    console.log('✅ Détourage réussi, upload sur Cloudinary...')

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
    
    // Ajouter fond blanc en préservant le ratio
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