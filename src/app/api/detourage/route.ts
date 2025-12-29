// app/api/detourage/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, rotation = 0 } = await req.json()

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl requis' }, { status: 400 })
    }

    console.log('🔄 Détourage pour:', imageUrl, 'rotation:', rotation)

    // Utiliser cjwbw/rembg au lieu de lucataco/remove-bg
    const output = await replicate.run(
      "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
      { input: { image: imageUrl } }
    )

    console.log('📦 Output:', output, typeof output)

    if (!output) {
      return NextResponse.json({ success: false, error: 'Pas de résultat de Replicate' })
    }

    const outputUrl = String(output)
    console.log('✅ URL détourée:', outputUrl)

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    const imgResponse = await fetch(outputUrl)
    if (!imgResponse.ok) {
      return NextResponse.json({ success: false, error: 'Erreur téléchargement image' })
    }

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
      ? `${urlParts[0]}/upload/${rotationTransform}b_white,c_lpad,ar_1:1,w_1200,h_1200,g_center,q_auto:best/${urlParts[1]}`
      : baseUrl

    return NextResponse.json({ success: true, maskUrl: finalUrl })

  } catch (error: any) {
    console.error('❌ Erreur détourage:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
