// app/api/generate-tryon/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { getOutfitPrompt as getOutfitHiver } from '@/lib/tryonOutfitsHiver'
import { getOutfitPrompt as getOutfitEte } from '@/lib/tryonOutfitsEte'

async function uploadToBunny(imageUrl: string): Promise<string> {
  const storageZone = process.env.BUNNY_STORAGE_ZONE
  const apiKey = process.env.BUNNY_API_KEY
  const cdnUrl = process.env.NEXT_PUBLIC_BUNNY_CDN_URL

  if (!storageZone || !apiKey || !cdnUrl) {
    throw new Error('Configuration Bunny manquante')
  }

  // Télécharger l'image depuis l'URL FASHN
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) throw new Error('Erreur téléchargement image FASHN')
  const rawBuffer = await imageResponse.arrayBuffer()
  
  // Redimensionner en carré 1200x1200
  const buffer = await sharp(Buffer.from(rawBuffer))
    .resize(1200, 1200, { fit: 'cover', position: 'top' })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer()

  // Générer un nom de fichier unique
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const filename = `on-model_${timestamp}_${random}.png`
  const path = `produits/on-model/${filename}`

  // Upload vers Bunny
  const response = await fetch(`https://storage.bunnycdn.com/${storageZone}/${path}`, {
    method: 'PUT',
    headers: {
      'AccessKey': apiKey,
      'Content-Type': 'image/png',
    },
    body: Buffer.from(buffer),
  })

  if (!response.ok) throw new Error('Erreur upload Bunny')

  return `${cdnUrl}/${path}`
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, productName, gender = 'female', categorie = '', matiere = '', view = 'front', seed } = await req.json()

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

    // Sélection pondérée du modèle (représentativité française approx.)
    const modelPool = gender === 'male' ? [
      { weight: 35, desc: 'fair-skinned man with short brown hair' },
      { weight: 25, desc: 'fair-skinned man with short blonde hair' },
      { weight: 10, desc: 'fair-skinned man with short red hair' },
      { weight: 12, desc: 'dark brown-skinned man with short black hair' },
      { weight: 10, desc: 'olive-skinned man with short dark brown hair' },
      { weight: 5, desc: 'East Asian man with straight black hair' },
      { weight: 3, desc: 'light brown-skinned man with short curly dark hair' },
    ] : [
      { weight: 35, desc: 'fair-skinned woman with straight brown hair' },
      { weight: 25, desc: 'fair-skinned woman with straight blonde hair' },
      { weight: 10, desc: 'fair-skinned woman with wavy red hair' },
      { weight: 12, desc: 'dark brown-skinned woman with coily black hair' },
      { weight: 10, desc: 'olive-skinned woman with wavy dark brown hair' },
      { weight: 5, desc: 'East Asian woman with straight black hair' },
      { weight: 3, desc: 'light brown-skinned woman with curly dark hair' },
      
    ]
    const totalWeight = modelPool.reduce((sum, m) => sum + m.weight, 0)
    // Utiliser le seed pour sélectionner le même mannequin face + dos
    const seedRand = seed ? ((seed % 1000) / 1000) : Math.random()
    let rand = seedRand * totalWeight
    let selectedModel = modelPool[0].desc
    for (const m of modelPool) {
      rand -= m.weight
      if (rand <= 0) { selectedModel = m.desc; break }
    }

    const now = new Date()
    const mmdd = now.getMonth() * 100 + now.getDate()
    const isSummer = mmdd >= 126 && mmdd <= 726
    const getOutfitPrompt = isSummer ? getOutfitEte : getOutfitHiver
    const outfitAccessories = getOutfitPrompt(categorie, { nom: productName, matiere })

    const maleOutfit = isSummer
      ? `wearing relaxed fit chinos and leather sandals${Math.random() < 0.3 ? ', baseball cap' : ''}, square black sunglasses`
      : 'wearing relaxed fit trousers and dress shoes'
    const prompt = gender === 'male'
      ? `${selectedModel}, standing straight, hands by sides, ${view === 'back' ? 'seen from behind, back facing camera, back of head visible, facing away from camera, ' : ''}neutral expression, minimalist studio, ${maleOutfit}, professional editorial fashion shoot, plain white studio background`
      : `${selectedModel}, ${view === 'back' ? 'seen from behind, back facing camera, back of head visible, facing away from camera, ' : ''}standing straight, hands by sides, ${view === 'front' ? 'neutral expression, ' : ''}minimalist studio, professional editorial fashion shoot, ${outfitAccessories}`
    console.log('🎨 Prompt choisi:', prompt)
    
    const fashnResponse = await fetch('https://api.fashn.ai/v1/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fashnApiKey}`,
        'Content-Type': 'application/json',
      },
      
      body: JSON.stringify({
      model_name: 'product-to-model',
      inputs: {
        product_image: imageUrl,
        resolution: '1k',
        prompt: prompt,
        aspect_ratio: '3:4',
...(seed ? { seed } : {}),
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

    // 3. Re-upload vers Bunny pour avoir une URL permanente
    console.log('☁️ Upload vers Bunny...')
    const finalUrl = await uploadToBunny(modelImageUrl)

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