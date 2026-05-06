  // app/api/detourage/route.ts
  import { NextRequest, NextResponse } from 'next/server'
  import Replicate from 'replicate'
  import sharp from 'sharp'

  async function deleteBunnyFile(url: string) {
    try {
      const cdnUrl = process.env.NEXT_PUBLIC_BUNNY_CDN_URL
      if (!url.startsWith(cdnUrl!)) return
      
      const path = url.replace(cdnUrl + '/', '')
      const storageZone = process.env.BUNNY_STORAGE_ZONE
      const apiKey = process.env.BUNNY_API_KEY
      
      await fetch(`https://storage.bunnycdn.com/${storageZone}/${path}`, {
        method: 'DELETE',
        headers: { 'AccessKey': apiKey! }
      })
      console.log('🗑️ Ancienne image supprimée:', path)
    } catch (err) {
      console.error('Erreur suppression Bunny:', err)
    }
  }

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  })

  export async function POST(req: NextRequest) {
    try {
      const { imageUrl, rotation = 0, base64, uploadOnly, mode, applyTransform, offset, zoom = 1, formatOnly, categorie } = await req.json()

      // Mode uploadOnly avec base64 (upload brut avant PhotoEditor)
      if (base64 && (uploadOnly || mode === 'erased')) {
        console.log('🔄 Conserver (base64, sans détourage), rotation:', rotation)
        
        let sharpInstance = sharp(Buffer.from(base64, 'base64'))

        if (rotation !== 0) {
          sharpInstance = sharpInstance.rotate(rotation)
        }

        const finalBuffer = await sharpInstance
          .resize(1200, 1200, { fit: 'cover', position: 'centre' })
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .png({ quality: 90 })
          .toBuffer()

        const storageZone = process.env.BUNNY_STORAGE_ZONE
        const apiKey = process.env.BUNNY_API_KEY
        const cdnUrl = process.env.NEXT_PUBLIC_BUNNY_CDN_URL

        const timestamp = Date.now()
        const random = Math.random().toString(36).substring(2, 8)
        const path = `produits/conserved_${timestamp}_${random}.png`

        await fetch(`https://storage.bunnycdn.com/${storageZone}/${path}`, {
          method: 'PUT',
          headers: { 'AccessKey': apiKey!, 'Content-Type': 'image/png' },
          body: finalBuffer,
        })

        const finalUrl = `${cdnUrl}/${path}`
        return NextResponse.json({ success: true, maskUrl: finalUrl, rawUrl: finalUrl, url: finalUrl })
      }
      // Mode rotation/position (après détourage)
      if (imageUrl && applyTransform) {
        const hasRotation = rotation !== 0
        const hasOffset = offset && (offset.x !== 0 || offset.y !== 0)
        const hasZoom = zoom !== 1
        
        // Si rien à faire, retourner l'URL originale
        if (!hasRotation && !hasOffset && !hasZoom) {
          return NextResponse.json({ success: true, maskUrl: imageUrl })
        }

        console.log('🔄 Rotation/Position:', rotation, '°, offset:', offset)
        
        const imgResponse = await fetch(imageUrl)
        const imgBuffer = Buffer.from(await imgResponse.arrayBuffer())
        
      // Rotation + offset + recentrage
        const rotated = await sharp(imgBuffer)
          .rotate(rotation, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .toBuffer()
        
        // Appliquer l'offset en ajoutant des marges
        const ox = offset?.x || 0
        const oy = offset?.y || 0
        console.log('📐 Applying offset - ox:', ox, 'oy:', oy)
        
      // Appliquer l'offset (extend avec blanc), puis zoom (resize), puis cover crop carré
        let processedBuffer = await sharp(rotated)
          .extend({
            top: Math.max(0, oy),
            bottom: Math.max(0, -oy),
            left: Math.max(0, ox),
            right: Math.max(0, -ox),
            background: { r: 255, g: 255, b: 255 }
          })
          .toBuffer()

        if (zoom !== 1) {
          const meta = await sharp(processedBuffer).metadata()
          const w = meta.width || 1200
          const h = meta.height || 1200
          processedBuffer = await sharp(processedBuffer)
            .resize(Math.max(1, Math.round(w * zoom)), Math.max(1, Math.round(h * zoom)))
            .toBuffer()
        }

        // Crop carré 1200×1200 cover (jamais de bandes blanches)
        processedBuffer = await sharp(processedBuffer)
          .resize(1200, 1200, { fit: 'cover', position: 'centre' })
          .toBuffer()

        // Finaliser
        const rotatedBuffer = await sharp(processedBuffer)
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .png({ quality: 90 })
          .toBuffer()
              
        const storageZone = process.env.BUNNY_STORAGE_ZONE
        const apiKey = process.env.BUNNY_API_KEY
        const cdnUrl = process.env.NEXT_PUBLIC_BUNNY_CDN_URL
        
        const timestamp = Date.now()
        const random = Math.random().toString(36).substring(2, 8)
        const path = `produits/rotated_${timestamp}_${random}.png`
        
        await fetch(`https://storage.bunnycdn.com/${storageZone}/${path}`, {
          method: 'PUT',
          headers: { 'AccessKey': apiKey!, 'Content-Type': 'image/png' },
          body: rotatedBuffer,
        })
        
        const finalUrl = `${cdnUrl}/${path}`
        
        // Supprimer l'ancienne version
        await deleteBunnyFile(imageUrl)
        
        return NextResponse.json({ success: true, maskUrl: finalUrl })
      }

      // Mode formatOnly
      if (imageUrl && formatOnly) {
        console.log('🔄 Format only (carré 1200x1200)')
        
        const imgResponse = await fetch(imageUrl)
        const imgBuffer = Buffer.from(await imgResponse.arrayBuffer())
        
        const finalBuffer = await sharp(imgBuffer)
          .resize(1200, 1200, { fit: 'cover', position: 'centre' })
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .modulate({ brightness: 1.05, saturation: 1.15 })
          .sharpen({ sigma: 1.2 })
          .png({ quality: 90 })
          .toBuffer()
        
        const storageZone = process.env.BUNNY_STORAGE_ZONE
        const apiKey = process.env.BUNNY_API_KEY
        const cdnUrl = process.env.NEXT_PUBLIC_BUNNY_CDN_URL
        
        const timestamp = Date.now()
        const random = Math.random().toString(36).substring(2, 8)
        const path = `produits/formatted_${timestamp}_${random}.png`
        
        await fetch(`https://storage.bunnycdn.com/${storageZone}/${path}`, {
          method: 'PUT',
          headers: { 'AccessKey': apiKey!, 'Content-Type': 'image/png' },
          body: finalBuffer,
        })
        
        const finalUrl = `${cdnUrl}/${path}`
        return NextResponse.json({ success: true, maskUrl: finalUrl })
      }

      if (!imageUrl || typeof imageUrl !== 'string') {
        return NextResponse.json({ error: 'imageUrl requis' }, { status: 400 })
      }

      console.log('🔄 Détourage pour:', imageUrl, 'rotation:', rotation)

      // Télécharger et convertir en RGB avant Replicate
      const preResponse = await fetch(imageUrl)
      const preBuffer = Buffer.from(await preResponse.arrayBuffer())
      const rgbBuffer = await sharp(preBuffer).toColorspace('srgb').png().toBuffer()
      const base64Image = `data:image/png;base64,${rgbBuffer.toString('base64')}`

      const isObjet = categorie && ["sac","pochette","ceinture","chaussures","bijoux","accessoire","botte","chapeau","lunettes","porte"].some(c => categorie.toLowerCase().includes(c))

      let output
      if (isObjet) {
        output = await replicate.run("lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1", { input: { image: base64Image } })
      } else {
        output = await replicate.run(
          "lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1",
          { input: { image: base64Image } }
        )
      }

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

      // Trim + cover crop 1200x1200 (jamais de bandes blanches sur les côtés)
      const trimResult = await sharpInstance.trim().toBuffer({ resolveWithObject: true })
      const trimmedBuffer = trimResult.data
      const trimLeft = Math.abs(trimResult.info.trimOffsetLeft || 0)
      const trimTop = Math.abs(trimResult.info.trimOffsetTop || 0)
      const trimW = trimResult.info.width
      const trimH = trimResult.info.height

      const finalBuffer = await sharp(trimmedBuffer)
        .resize(1200, 1200, { fit: 'cover', position: 'centre' })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .modulate({ brightness: 1.08, saturation: 1.20 })
        .gamma(1.05)
        .sharpen({ sigma: 1.5 })
        .png({ quality: 90 })
        .toBuffer()

      console.log('🖼️ Image détourée (cover 1200×1200):', trimW, 'x', trimH)

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

      // Source alignée pour restauration (même cadrage cover que le détouré)
      let sourceSharp = sharp(preBuffer)
      if (rotation !== 0) sourceSharp = sourceSharp.rotate(rotation)
      const sourceBuffer = await sourceSharp
        .extract({ left: trimLeft, top: trimTop, width: trimW, height: trimH })
        .resize(1200, 1200, { fit: 'cover', position: 'centre' })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .png({ quality: 90 })
        .toBuffer()
      const sourcePath = `produits/source_${timestamp}_${random}.png`
      await fetch(`https://storage.bunnycdn.com/${storageZone}/${sourcePath}`, {
        method: 'PUT',
        headers: { 'AccessKey': apiKey, 'Content-Type': 'image/png' },
        body: sourceBuffer,
      })
      const sourceUrl = `${cdnUrl}/${sourcePath}`

      return NextResponse.json({ 
        success: true, 
        maskUrl: finalUrl,
        rawUrl: outputUrl,
        sourceUrl: sourceUrl,
      })

    } catch (error: any) {
      console.error('❌ Erreur détourage:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }