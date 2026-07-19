import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  })
}

const bucket = getStorage().bucket()
console.log(`Bucket: ${bucket.name}`)

for (const key of ['produits-all', 'chineuses-lite', 'chineuses-full-admin', 'iconiques']) {
  const file = bucket.file(`_cache/${key}.json.gz`)
  const [exists] = await file.exists()
  if (!exists) {
    console.log(`  ${key}: ABSENT`)
    continue
  }
  const [meta] = await file.getMetadata()
  const updatedAt = new Date(meta.updated)
  const ageMinutes = Math.floor((Date.now() - updatedAt.getTime()) / 60000)
  const sizeKb = Math.round(Number(meta.size) / 1024)
  console.log(`  ${key}: OK size=${sizeKb}KB updatedAt=${updatedAt.toISOString()} age=${ageMinutes}min`)
}
