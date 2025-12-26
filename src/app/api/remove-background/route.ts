// app/api/remove-background/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

async function runWithRetry(imageUrl: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const output = await replicate.run(
        "lucataco/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
        {
          input: {
            image: imageUrl
          }
        }
      )
      return output
    } catch (error: any) {
      if (error.message?.includes('429') && i < retries - 1) {
        console.log(`⏳ Rate limit, retry dans 3s... (${i + 1}/${retries})`)
        await new Promise(resolve => setTimeout(resolve, 3000))
      } else {
        throw error
      }
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json()
    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl requis' }, { status: 400 })
    }

    console.log('🔄 Détourage Replicate pour:', imageUrl)

    const output = await runWithRetry(imageUrl)

    console.log('✅ Détourage terminé:', output)

    const replicateUrl = typeof output === 'object' && output !== null && 'url' in output
      ? (output as any).url()
      : typeof output === 'string'
        ? output
        : null

    if (!replicateUrl) {
      return NextResponse.json({ success: true, removedBgUrl: null })
    }

    const imgResponse = await fetch(replicateUrl)
    if (!imgResponse.ok) {
      console.error('❌ Erreur téléchargement image détourée')
      return NextResponse.json({ success: true, removedBgUrl: null })
    }
    const blob = await imgResponse.blob()

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