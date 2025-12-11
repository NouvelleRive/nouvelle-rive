// app/api/generate-tryon/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

/**
 * Upload une image vers Cloudinary depuis une URL
 */
async function uploadToCloudinary(imageUrl: string): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    throw new Error('Configuration Cloudinary manquante')
  }

  const formData = new FormData()
  formData.append('file', imageUrl)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'produits/on-model')

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  )

  if (!response.ok) {
    throw new Error('Erreur upload Cloudinary')
  }

  const data = await response.json()
  return data.secure_url
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, productName } = await req.json()

    console.log('📥 Génération photo portée pour:', productName || 'produit')

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'imageUrl manquante' },
        { status: 400 }
      )
    }

    const fashnApiKey = process.env.FASHN_API_KEY

    if (!fashnApiKey) {
      return NextResponse.json(
        { success: false, error: 'FASHN_API_KEY manquante dans .env.local' },
        { status: 500 }
      )
    }

    // 1. Appel FASHN.ai avec le nouvel endpoint /v1/run
    console.log('🤖 Appel FASHN.ai (product-to-model)...')
    
    const fashnResponse = await fetch('https://api.fashn.ai/v1/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fashnApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_name: 'product-to-model',
        input: {
          product_image: imageUrl,
          mode: 'quality'
        }
      }),
    })

    if (!fashnResponse.ok) {
      const errorText = await fashnResponse.text()
      console.error('❌ Erreur FASHN.ai:', fashnResponse.status, errorText)
      return NextResponse.json(
        { success: false, error: `FASHN.ai error: ${fashnResponse.status}` },
        { status: 500 }
      )
    }

    const fashnData = await fashnResponse.json()
    const predictionId = fashnData.id
    
    if (!predictionId) {
      console.error('❌ Pas de prediction id retourné par FASHN')
      return NextResponse.json(
        { success: false, error: 'Pas de prediction id retourné' },
        { status: 500 }
      )
    }

    console.log('⏳ Prediction FASHN créée:', predictionId)

    // 2. Poll le résultat via /v1/status/<ID> (max 60 secondes)
    let attempts = 0
    let modelImageUrl: string | null = null

    while (attempts < 60 && !modelImageUrl) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const statusResponse = await fetch(`https://api.fashn.ai/v1/status/${predictionId}`, {
        headers: {
          'Authorization': `Bearer ${fashnApiKey}`,
        },
      })

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        
        console.log('📊 Status FASHN:', statusData.status)
        
        if (statusData.status === 'completed' && statusData.output && statusData.output.length > 0) {
          modelImageUrl = statusData.output[0]
          console.log('✅ Image générée par FASHN:', modelImageUrl)
        } else if (statusData.status === 'failed') {
          const errorMsg = statusData.error?.message || 'Unknown error'
          throw new Error('FASHN job failed: ' + errorMsg)
        }
      }
      
      attempts++
    }

    if (!modelImageUrl) {
      return NextResponse.json(
        { success: false, error: 'Timeout: image non générée après 60s' },
        { status: 500 }
      )
    }

    // 3. Re-upload vers Cloudinary pour avoir une URL permanente
    console.log('☁️ Upload vers Cloudinary...')
    const finalUrl = await uploadToCloudinary(modelImageUrl)

    console.log('✅ Photo portée générée:', finalUrl)

    return NextResponse.json({
      success: true,
      onModelUrl: finalUrl,
      originalFashnUrl: modelImageUrl
    })

  } catch (e: any) {
    console.error('❌ [generate-tryon] Erreur:', e?.message)
    return NextResponse.json(
      { success: false, error: e?.message || 'Erreur interne' },
      { status: 500 }
    )
  }
}