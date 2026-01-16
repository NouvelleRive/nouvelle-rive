// scripts/cleanup-cloudinary-duplicates.ts
import * as dotenv from 'dotenv'
import { v2 as cloudinary } from 'cloudinary'
import * as admin from 'firebase-admin'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })

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

async function main() {
  console.log('🔍 Fetching Cloudinary resources...\n')

  // 1. Récupérer toutes les images Cloudinary
  const resources: any[] = []
  let nextCursor: string | undefined
  do {
    const result: any = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'produits',
      max_results: 500,
      next_cursor: nextCursor,
    })
    resources.push(...result.resources)
    nextCursor = result.next_cursor
  } while (nextCursor)

  console.log(`📊 Total Cloudinary images: ${resources.length}`)

  // 2. Récupérer toutes les URLs utilisées dans Firebase
  console.log('\n🔥 Fetching Firebase products...')
  const snapshot = await db.collection('produits').get()
  const usedUrls = new Set<string>()

  snapshot.docs.forEach((doc) => {
    const data = doc.data()
    
    // Collecter toutes les URLs utilisées
    if (data.imageUrl) usedUrls.add(data.imageUrl)
    if (data.imageUrls) data.imageUrls.forEach((url: string) => usedUrls.add(url))
    if (data.photos) {
      if (data.photos.face) usedUrls.add(data.photos.face)
      if (data.photos.faceOnModel) usedUrls.add(data.photos.faceOnModel)
      if (data.photos.dos) usedUrls.add(data.photos.dos)
      if (data.photos.details) data.photos.details.forEach((url: string) => usedUrls.add(url))
    }
  })

  console.log(`📦 Firebase products: ${snapshot.size}`)
  console.log(`🔗 Unique URLs in Firebase: ${usedUrls.size}`)

  // 3. Trouver les images Cloudinary non utilisées
  const unusedResources: any[] = []

  for (const r of resources) {
    const url = r.secure_url
    if (!usedUrls.has(url)) {
      unusedResources.push(r)
    }
  }

  console.log(`\n🗑️  Unused images in Cloudinary: ${unusedResources.length}`)

  if (unusedResources.length === 0) {
    console.log('✅ No unused images found!')
    return
  }

  // Calculer l'espace
  const bytesToFree = unusedResources.reduce((sum, r) => sum + (r.bytes || 0), 0)
  console.log(`💾 Space to free: ${(bytesToFree / 1024 / 1024).toFixed(2)} MB`)

  // Afficher quelques exemples
  console.log('\n⚠️  First 10 unused images:')
  unusedResources.slice(0, 10).forEach((r) => {
    console.log(`   - ${r.public_id} (${(r.bytes / 1024).toFixed(0)} KB)`)
  })

  // Demander confirmation
  const readline = await import('readline')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  const answer = await new Promise<string>((resolve) => {
    rl.question('\n🚀 Delete these unused images? (yes/no): ', resolve)
  })
  rl.close()

  if (answer.toLowerCase() !== 'yes') {
    console.log('❌ Cancelled')
    return
  }

  // Supprimer par batch
  console.log('\n🗑️  Deleting...')
  const batchSize = 100
  let deleted = 0

  for (let i = 0; i < unusedResources.length; i += batchSize) {
    const batch = unusedResources.slice(i, i + batchSize).map((r) => r.public_id)
    try {
      await cloudinary.api.delete_resources(batch)
      deleted += batch.length
      console.log(`   Deleted ${deleted}/${unusedResources.length}`)
    } catch (err) {
      console.error(`   Error:`, err)
    }
  }

  console.log(`\n✅ Done! Deleted ${deleted} unused images`)
  console.log(`💾 Freed ~${(bytesToFree / 1024 / 1024).toFixed(2)} MB`)
}

main().catch(console.error)