// scripts/recover-images.ts
import { v2 as cloudinary } from 'cloudinary'
import * as admin from 'firebase-admin'
import * as fs from 'fs'

// Firebase Admin init
const serviceAccount = JSON.parse(fs.readFileSync('./functions/serviceAccountKey.json', 'utf8'))
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}
const db = admin.firestore()

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Extraire l'URL originale sans transformations
function getOriginalUrl(url: string): string {
  // Transformer les URLs avec transformations en URLs simples
  // De: https://res.cloudinary.com/xxx/image/upload/c_pad,ar_1:1,.../v123/produits/abc.jpg
  // Vers: https://res.cloudinary.com/xxx/image/upload/v123/produits/abc.jpg
  const match = url.match(/(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/).*?(v\d+\/produits\/[^.]+\.[a-z]+)/i)
  if (match) {
    return `${match[1]}${match[2]}`
  }
  return url
}

async function main() {
  console.log('🔍 Fetching all image URLs from Firebase...\n')

  const snapshot = await db.collection('produits').get()
  
  // Collecter toutes les URLs uniques (version originale)
  const urlSet = new Set<string>()
  
  snapshot.docs.forEach((doc) => {
    const data = doc.data()
    if (data.imageUrl) urlSet.add(getOriginalUrl(data.imageUrl))
    if (data.imageUrls) data.imageUrls.forEach((url: string) => urlSet.add(getOriginalUrl(url)))
    if (data.photos) {
      if (data.photos.face) urlSet.add(getOriginalUrl(data.photos.face))
      if (data.photos.faceOnModel) urlSet.add(getOriginalUrl(data.photos.faceOnModel))
      if (data.photos.dos) urlSet.add(getOriginalUrl(data.photos.dos))
      if (data.photos.details) data.photos.details.forEach((url: string) => urlSet.add(getOriginalUrl(url)))
    }
  })

  const urls = Array.from(urlSet).filter(url => url && url.includes('cloudinary'))
  console.log(`📊 Found ${urls.length} unique Cloudinary URLs to recover\n`)

  let recovered = 0
  let failed = 0
  const failedUrls: string[] = []

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    
    try {
      // Extraire le public_id de l'URL
      const match = url.match(/\/produits\/([^.]+)/)
      if (!match) {
        console.log(`⚠️  Cannot parse: ${url}`)
        failed++
        failedUrls.push(url)
        continue
      }
      
      const publicId = `produits/${match[1]}`
      
      // Re-uploader depuis l'URL (le cache CDN)
      await cloudinary.uploader.upload(url, {
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
      })
      
      recovered++
      console.log(`✅ ${i + 1}/${urls.length} Recovered: ${publicId}`)
      
    } catch (err: any) {
      failed++
      failedUrls.push(url)
      console.log(`❌ ${i + 1}/${urls.length} Failed: ${url.substring(0, 80)}... - ${err.message?.substring(0, 50)}`)
    }
    
    // Petite pause pour ne pas surcharger l'API
    if (i % 10 === 0 && i > 0) {
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  console.log(`\n✅ Done!`)
  console.log(`   Recovered: ${recovered}`)
  console.log(`   Failed: ${failed}`)
  
  if (failedUrls.length > 0) {
    fs.writeFileSync('failed-urls.txt', failedUrls.join('\n'))
    console.log(`\n❌ Failed URLs saved to failed-urls.txt`)
  }
}

main().catch(console.error)