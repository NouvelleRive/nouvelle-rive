// app/api/generate-tryon/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

/**
 * Télécharge une image depuis une URL et retourne le buffer
 */
async function downloadImageAsBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Échec téléchargement image: ${response.status}`)
  }
  
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Upload une image vers Cloudinary avec détourage automatique
 */
async function uploadToCloudinaryWithRemoveBg(imageBuffer: Buffer): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    throw new Error('Configuration Cloudinary manquante')
  }

  const formData = new FormData()
  const blob = new Blob([imageBuffer], { type: 'image/jpeg' })
  formData.append('file', blob)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'produits/on-model')
  
  // Transformations Cloudinary : détourage + optimisation
  formData.append('transformation', JSON.stringify([
    { effect: 'bgremoval' }, // Détourage automatique
    { quality: 'auto:best' },
    { fetch_format: 'auto' }
  ]))

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Erreur Cloudinary:', errorText)
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

    // 1. Appel FASHN.ai Product-to-Model
    console.log('🤖 Appel FASHN.ai...')
    
    const fashnResponse = await fetch('https://api.fashn.ai/v1/product-to-model', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fashnApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_name: 'product-to-model-v1',
        garment_image_url: imageUrl,
        // Configuration par défaut - modèle générique
        model_config: {
          gender: 'female', // Par défaut femme, tu peux ajouter un param si besoin
          body_type: 'average',
          pose: 'standing'
        }
      }),
    })

    if (!fashnResponse.ok) {
      const errorText = await fashnResponse.text()
      console.error('❌ Erreur FASHN.ai:', errorText)
      return NextResponse.json(
        { success: false, error: `FASHN.ai error: ${fashnResponse.status}` },
        { status: 500 }
      )
    }

    const fashnData = await fashnResponse.json()
    
    // FASHN retourne un job_id, il faut ensuite poll le résultat
    const jobId = fashnData.job_id
    
    if (!jobId) {
      console.error('❌ Pas de job_id retourné par FASHN')
      return NextResponse.json(
        { success: false, error: 'Pas de job_id retourné' },
        { status: 500 }
      )
    }

    console.log('⏳ Job FASHN créé:', jobId)

    // 2. Poll le résultat (max 30 secondes)
    let attempts = 0
    let modelImageUrl: string | null = null

    while (attempts < 30 && !modelImageUrl) {
      await new Promise(resolve => setTimeout(resolve, 1000)) // Attendre 1 seconde
      
      const resultResponse = await fetch(`https://api.fashn.ai/v1/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${fashnApiKey}`,
        },
      })

      if (resultResponse.ok) {
        const resultData = await resultResponse.json()
        
        if (resultData.status === 'completed' && resultData.output_url) {
          modelImageUrl = resultData.output_url
          console.log('✅ Image générée par FASHN:', modelImageUrl)
        } else if (resultData.status === 'failed') {
          throw new Error('FASHN job failed: ' + (resultData.error || 'Unknown error'))
        }
      }
      
      attempts++
    }

    if (!modelImageUrl) {
      return NextResponse.json(
        { success: false, error: 'Timeout: image non générée après 30s' },
        { status: 500 }
      )
    }

    // 3. Télécharger l'image générée
    console.log('📥 Téléchargement de l\'image générée...')
    const modelImageBuffer = await downloadImageAsBuffer(modelImageUrl)

    // 4. Re-upload vers Cloudinary avec détourage
    console.log('☁️ Upload vers Cloudinary avec détourage...')
    const finalUrl = await uploadToCloudinaryWithRemoveBg(modelImageBuffer)

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