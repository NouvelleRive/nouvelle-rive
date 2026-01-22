// app/api/detourage/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'
import sharp from 'sharp'

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

    // 1. Détourage via Replicate
    const output = await replicate.run(
  "lucataco/remove-bg",
  { input: { image: imageUrl } }
)

    console.log('📦 Output Replicate:', output, typeof output)

    if (!output) {
      return NextResponse.json({ success: false, error: 'Pas de résultat de Replicate' })
    }

    const outputUrl = String(output)
    console.log('✅ URL détourée:', outputUrl)

    // 2. Télécharger l'image détourée
    const imgResponse = await fetch(outputUrl)
    if (!imgResponse.ok) {
      return NextResponse.json({ success: false, error: 'Erreur téléchargement image' })
    }

    const arrayBuffer = await imgResponse.arrayBuffer()
    let imageBuffer = Buffer.from(arrayBuffer)

    // 3. Appliquer les transformations avec Sharp
    let sharpInstance = sharp(imageBuffer)

    // Rotation si demandée
    if (rotation !== 0) {
      sharpInstance = sharpInstance.rotate(rotation)
    }

    // Trim (supprimer les bords transparents)
    sharpInstance = sharpInstance.trim()

    // Récupérer les métadonnées après trim pour le padding
    const trimmedBuffer = await sharpInstance.toBuffer()
    const metadata = await sharp(trimmedBuffer).metadata()
    const trimmedWidth = metadata.width || 1200
    const trimmedHeight = metadata.height || 1200

    // Calculer la taille du carré (le plus grand côté + marge)
    const maxDim = Math.max(trimmedWidth, trimmedHeight)
    const targetSize = Math.min(Math.ceil(maxDim * 1.1), 1200) // 10% de marge, max 1200

    // Créer l'image finale : fond blanc, carré, centré
    const finalBuffer = await sharp(trimmedBuffer)
      .resize(targetSize, targetSize, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } }) // Fond blanc opaque
      .resize(1200, 1200) // Taille finale
      .modulate({
        brightness: 1.08,  // e_brightness:8
        saturation: 1.20,  // e_vibrance:20
      })
      .gamma(1.05)  // e_gamma:105
      .sharpen({ sigma: 1.5 })  // e_sharpen:40
      .png({ quality: 90 })
      .toBuffer()

    console.log('🖼️ Transformations Sharp appliquées')

    // 4. Upload vers Bunny
    const storageZone = process.env.BUNNY_STORAGE_ZONE
    const apiKey = process.env.BUNNY_API_KEY
    const cdnUrl = process.env.NEXT_PUBLIC_BUNNY_CDN_URL

    if (!storageZone || !apiKey || !cdnUrl) {
      return NextResponse.json({ success: false, error: 'Configuration Bunny manquante' })
    }

    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const filename = `detoured_${timestamp}_${random}.png`
    const path = `produits/${filename}`

    const bunnyResponse = await fetch(`https://storage.bunnycdn.com/${storageZone}/${path}`, {
      method: 'PUT',
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'image/png',
      },
      body: finalBuffer,
    })

    if (!bunnyResponse.ok) {
      console.error('❌ Erreur Bunny:', bunnyResponse.status)
      return NextResponse.json({ success: false, error: `Erreur upload Bunny: ${bunnyResponse.status}` })
    }

    const finalUrl = `${cdnUrl}/${path}`
    console.log('✅ Upload Bunny réussi:', finalUrl)

    return NextResponse.json({ 
      success: true, 
      maskUrl: finalUrl,
      rawUrl: outputUrl // URL brute de Replicate (temporaire)
    })

  } catch (error: any) {
    console.error('❌ Erreur détourage:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}