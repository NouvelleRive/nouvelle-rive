// app/api/segment-sam/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, points } = await req.json()
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl requis' }, { status: 400 })
    }

    if (!points || points.length === 0) {
      return NextResponse.json({ error: 'points requis (au moins un clic)' }, { status: 400 })
    }

    console.log('🎯 Segmentation SAM pour:', imageUrl)
    console.log('📍 Points:', points)

    const inputPoints = points.map((p: { x: number, y: number }) => [p.x, p.y])
    const inputLabels = points.map((p: { x: number, y: number, label?: number }) => p.label ?? 1)

    const output = await replicate.run(
      "meta/sam-2-box:8fc3ce92fdd32474a9387df1eded1d59ed374fe5b62451657d1e50e0878e9723",
      {
        input: {
          image: imageUrl,
          point_coords: inputPoints,
          point_labels: inputLabels,
          multimask_output: false
        }
      }
    )

    console.log('✅ SAM output:', output)

    let maskUrl = null
    if (output && typeof output === 'object') {
      if (Array.isArray(output) && output.length > 0) {
        maskUrl = output[0]
      }
    } else if (typeof output === 'string') {
      maskUrl = output
    }

    if (!maskUrl) {
      return NextResponse.json({ success: false, error: 'Pas de masque généré' })
    }

    // Upload le masque sur Cloudinary
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    const imgResponse = await fetch(maskUrl)
    if (!imgResponse.ok) {
      return NextResponse.json({ success: false, error: 'Erreur téléchargement masque' })
    }
    const blob = await imgResponse.blob()

    const formData = new FormData()
    formData.append('file', blob, 'mask.png')
    formData.append('upload_preset', uploadPreset!)
    formData.append('folder', 'masks')

    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: formData }
    )

    if (!cloudinaryResponse.ok) {
      return NextResponse.json({ success: false, error: 'Erreur upload masque' })
    }

    const cloudinaryData = await cloudinaryResponse.json()
    console.log('✅ Masque uploadé:', cloudinaryData.secure_url)

    return NextResponse.json({ 
      success: true, 
      maskUrl: cloudinaryData.secure_url
    })

  } catch (error: any) {
    console.error('❌ Erreur SAM:', error.message)
    return NextResponse.json(
      { error: error.message || 'Erreur segmentation' },
      { status: 500 }
    )
  }
}