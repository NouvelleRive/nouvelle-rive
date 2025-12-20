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
      "smoretalk/rembg-enhance:4067ee2a58f6c161d434a9c077cfa012820b8e076efa2772aa171e26557da919",
      {
        input: {
          image: imageUrl
        }
      }
    )

    console.log('✅ Détourage terminé:', output)

    // Extraire l'URL avec la méthode .url()
    const replicateUrl = typeof output === 'object' && output !== null && 'url' in output
      ? (output as any).url()
      : typeof output === 'string'
        ? output
        : null

    if (!replicateUrl) {
      return NextResponse.json({ success: true, removedBgUrl: null })
    }

    // Télécharger l'image détourée côté serveur
    const imgResponse = await fetch(replicateUrl)
    if (!imgResponse.ok) {
      console.error('❌ Erreur téléchargement image détourée')
      return NextResponse.json({ success: true, removedBgUrl: null })
    }
    const blob = await imgResponse.blob()

    // Upload sur Cloudinary
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    const formData = new FormData()
    formData.append('file', blob, 'detoured.png')
    formData.append('upload_preset', uploadPreset!)
    formData.append('folder', 'produits')

    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: formData }
    )

    if (!cloudinaryResponse.ok) {
      console.error('❌ Erreur upload Cloudinary:', cloudinaryResponse.status)
      return NextResponse.json({ success: true, removedBgUrl: null })
    }

    const cloudinaryData = await cloudinaryResponse.json()
    const removedBgUrl = cloudinaryData.secure_url

    console.log('✅ URL Cloudinary:', removedBgUrl)

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