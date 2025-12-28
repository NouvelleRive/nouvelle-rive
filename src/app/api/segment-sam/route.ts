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

    console.log('🔄 Étape 1: Détourage vêtement...')
    
    // Étape 1: Détourage du vêtement
    const removeBgOutput = await replicate.run(
      "lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1",
      { input: { image: imageUrl } }
    )

    let detourageUrl = typeof removeBgOutput === 'string' ? removeBgOutput : null
    if (!detourageUrl && removeBgOutput && typeof removeBgOutput === 'object') {
      if (Array.isArray(removeBgOutput) && removeBgOutput.length > 0) {
        detourageUrl = removeBgOutput[0]
      }
    }

    if (!detourageUrl) {
      return NextResponse.json({ success: false, error: 'Échec détourage' })
    }

    console.log('✅ Détourage OK:', detourageUrl)
    console.log('🔄 Étape 2: Détection cintre...')

    // Étape 2: Détecter le cintre avec grounded-sam
    try {
      const samOutput = await replicate.run(
        "schananas/grounded_sam:ee871c19efb1941f55f66a3f1e6e94df115fa57e8077cb1e11690f9cba768546",
        {
          input: {
            image: detourageUrl,
            text_prompt: "hanger, coat hanger, clothes hanger"
          }
        }
      )

      console.log('📦 SAM output:', samOutput)

      // Si un cintre est détecté, on a un masque qu'on peut utiliser
      // Pour l'instant on log juste et on continue avec l'image détourée
      
    } catch (samError: any) {
      console.log('⚠️ Pas de cintre détecté ou erreur SAM:', samError.message)
      // On continue sans masquer le cintre
    }

    // Upload sur Cloudinary
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    const imgResponse = await fetch(detourageUrl)
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
    const finalUrl = urlParts.length === 2
      ? `${urlParts[0]}/upload/b_white,c_lpad,ar_1:1,w_1200,h_1200,g_center,q_auto:best/${urlParts[1]}`
      : baseUrl

    console.log('✅ URL finale:', finalUrl)

    return NextResponse.json({ 
      success: true, 
      maskUrl: finalUrl
    })

  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    return NextResponse.json(
      { error: error.message || 'Erreur' },
      { status: 500 }
    )
  }
}