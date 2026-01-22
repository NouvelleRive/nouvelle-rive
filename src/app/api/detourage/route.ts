// app/api/detourage/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'
import sharp from 'sharp'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, rotation = 0, base64, mode } = await req.json()

// Mode gomme : upload direct
if (mode === 'erased' && base64) {
  const buffer = Buffer.from(base64, 'base64')
  const storageZone = process.env.BUNNY_STORAGE_ZONE
  const apiKey = process.env.BUNNY_API_KEY
  const cdnUrl = process.env.NEXT_PUBLIC_BUNNY_CDN_URL
  
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const path = `produits/edited_${timestamp}_${random}.png`
  
  await fetch(`https://storage.bunnycdn.com/${storageZone}/${path}`, {
    method: 'PUT',
    headers: { 'AccessKey': apiKey!, 'Content-Type': 'image/png' },
    body: buffer,
  })
  
  return NextResponse.json({ success: true, maskUrl: `${cdnUrl}/${path}`, rawUrl: `${cdnUrl}/${path}` })
}

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl requis' }, { status: 400 })
    }

    console.log('🔄 Détourage pour:', imageUrl, 'rotation:', rotation)

    // 1. Détourage via Replicate (birefnet)
    const output = await replicate.run(
      "smoretalk/birefnet-massive:b76c8ce7ae4860517cdf2e57e610c84c2ffe7789c51d8eb79380de3ab2f6dad4",
      { input: { image: imageUrl } }
    )

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

    // Trim agressif (supprimer les bords transparents)
    const trimmedBuffer = await sharpInstance.trim({ threshold: 10 }).toBuffer()
    
    // Récupérer les dimensions après trim
    const metadata = await sharp(trimmedBuffer).metadata()
    const trimmedWidth = metadata.width || 1000
    const trimmedHeight = metadata.height || 1000

    // Calculer la taille pour que l'image prenne 90% du carré (moins de blanc)
    const maxDim = Math.max(trimmedWidth, trimmedHeight)
    const padding = Math.ceil(maxDim * 0.05) // seulement 5% de marge
    const canvasSize = maxDim + (padding * 2)
    const finalSize = Math.min(canvasSize, 1200)

    // Créer l'image finale : fond blanc, carré, centré, GRANDE
    const finalBuffer = await sharp(trimmedBuffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 255, g: 255, b: 255 }
      })
      .resize(finalSize, finalSize, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255 }
      })
      .resize(1200, 1200)
      .modulate({
        brightness: 1.05,
        saturation: 1.15,
      })
      .sharpen({ sigma: 1.2 })
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
      rawUrl: finalUrl // Maintenant c'est la même URL (Bunny), donc la gomme marchera
    })

  } catch (error: any) {
    console.error('❌ Erreur détourage:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}