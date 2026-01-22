// app/api/detourage/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'
import sharp from 'sharp'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

async function uploadToBunny(buffer: Buffer, prefix: string): Promise<string> {
  const storageZone = process.env.BUNNY_STORAGE_ZONE
  const apiKey = process.env.BUNNY_API_KEY
  const cdnUrl = process.env.NEXT_PUBLIC_BUNNY_CDN_URL

  if (!storageZone || !apiKey || !cdnUrl) {
    throw new Error('Configuration Bunny manquante')
  }

  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const path = `produits/${prefix}_${timestamp}_${random}.png`

  const response = await fetch(`https://storage.bunnycdn.com/${storageZone}/${path}`, {
    method: 'PUT',
    headers: { 'AccessKey': apiKey, 'Content-Type': 'image/png' },
    body: buffer,
  })

  if (!response.ok) {
    throw new Error(`Erreur Bunny: ${response.status}`)
  }

  return `${cdnUrl}/${path}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageUrl, rotation = 0, base64, mode, contentType, path, skipDetourage } = body

    // Mode gomme : upload base64 direct
    if (mode === 'erased' && base64) {
      const buffer = Buffer.from(base64, 'base64')
      const url = await uploadToBunny(buffer, 'edited')
      return NextResponse.json({ success: true, maskUrl: url, rawUrl: url, url })
    }

    // Mode raw : upload simple sans traitement
    if (mode === 'raw' && base64) {
      const buffer = Buffer.from(base64, 'base64')
      const prefix = path?.split('/').pop()?.split('.')[0] || 'raw'
      const url = await uploadToBunny(buffer, prefix)
      return NextResponse.json({ success: true, url })
    }

    // Mode skipDetourage avec base64
    if (skipDetourage && base64) {
      console.log('🔄 Conserver (base64, sans détourage), rotation:', rotation)
      
      let sharpInstance = sharp(Buffer.from(base64, 'base64'))

      if (rotation !== 0) {
        sharpInstance = sharpInstance.rotate(rotation)
      }

      const finalBuffer = await sharpInstance
        .resize(1200, 1200, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .modulate({ brightness: 1.05, saturation: 1.15 })
        .sharpen({ sigma: 1.2 })
        .png({ quality: 90 })
        .toBuffer()

      const finalUrl = await uploadToBunny(finalBuffer, 'conserved')
      return NextResponse.json({ success: true, maskUrl: finalUrl, rawUrl: finalUrl, url: finalUrl })
    }

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl requis' }, { status: 400 })
    }

    // Mode conserver : juste rotation + transformations, pas de détourage
    if (skipDetourage) {
      console.log('🔄 Conserver (sans détourage):', imageUrl, 'rotation:', rotation)
      
      const imgResponse = await fetch(imageUrl)
      if (!imgResponse.ok) {
        return NextResponse.json({ success: false, error: 'Erreur téléchargement image' })
      }

      const arrayBuffer = await imgResponse.arrayBuffer()
      let sharpInstance = sharp(Buffer.from(arrayBuffer))

      if (rotation !== 0) {
        sharpInstance = sharpInstance.rotate(rotation)
      }

      const finalBuffer = await sharpInstance
        .resize(1200, 1200, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .modulate({ brightness: 1.05, saturation: 1.15 })
        .sharpen({ sigma: 1.2 })
        .png({ quality: 90 })
        .toBuffer()

      const finalUrl = await uploadToBunny(finalBuffer, 'conserved')
      return NextResponse.json({ success: true, maskUrl: finalUrl, rawUrl: finalUrl, url: finalUrl })
    }

    console.log('🔄 Détourage pour:', imageUrl, 'rotation:', rotation)

    // Détourage via Replicate (birefnet)
    const output = await replicate.run(
      "smoretalk/birefnet-massive:b76c8ce7ae4860517cdf2e57e610c84c2ffe7789c51d8eb79380de3ab2f6dad4",
      { input: { image: imageUrl } }
    )

    if (!output) {
      return NextResponse.json({ success: false, error: 'Pas de résultat de Replicate' })
    }

    const outputUrl = String(output)
    console.log('✅ URL détourée:', outputUrl)

    // Télécharger l'image détourée
    const imgResponse = await fetch(outputUrl)
    if (!imgResponse.ok) {
      return NextResponse.json({ success: false, error: 'Erreur téléchargement image' })
    }

    const arrayBuffer = await imgResponse.arrayBuffer()
    let sharpInstance = sharp(Buffer.from(arrayBuffer))

    // Rotation si demandée
    if (rotation !== 0) {
      sharpInstance = sharpInstance.rotate(rotation)
    }

    // Trim + fond blanc + image grande
    const trimmedBuffer = await sharpInstance.trim({ threshold: 10 }).toBuffer()
    const metadata = await sharp(trimmedBuffer).metadata()
    const maxDim = Math.max(metadata.width || 1000, metadata.height || 1000)
    const padding = Math.ceil(maxDim * 0.05)

    const finalBuffer = await sharp(trimmedBuffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .extend({ top: padding, bottom: padding, left: padding, right: padding, background: { r: 255, g: 255, b: 255 } })
      .resize(1200, 1200, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .modulate({ brightness: 1.05, saturation: 1.15 })
      .sharpen({ sigma: 1.2 })
      .png({ quality: 90 })
      .toBuffer()

    const finalUrl = await uploadToBunny(finalBuffer, 'detoured')
    console.log('✅ Upload Bunny réussi:', finalUrl)

    return NextResponse.json({ success: true, maskUrl: finalUrl, rawUrl: finalUrl })

  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}