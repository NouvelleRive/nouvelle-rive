// scripts/reformat-detoured.js
// Reformate toutes les photos détourées (face + dos) : trim → 1000x1000 → centrage 1200x1200 blanc
// Usage : node scripts/reformat-detoured.js          (DRY RUN)
//         node scripts/reformat-detoured.js --apply   (APPLIQUE)

const admin = require('firebase-admin')
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

// Firebase Admin init
const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, '../functions/serviceAccountKey.json'), 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

// Bunny config — adapte si besoin
const BUNNY_STORAGE_ZONE = 'nouvellerive'
const BUNNY_API_KEY = process.env.BUNNY_API_KEY || '' // ou hardcode temporairement
const BUNNY_CDN_URL = 'https://nouvellerive.b-cdn.net'

const DRY_RUN = !process.argv.includes('--apply')

async function downloadImage(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

async function uploadToBunny(buffer, filePath) {
  const res = await fetch(`https://storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/${filePath}`, {
    method: 'PUT',
    headers: { 'AccessKey': BUNNY_API_KEY, 'Content-Type': 'image/png' },
    body: buffer,
  })
  if (!res.ok) throw new Error(`Bunny upload error: ${res.status}`)
  return `${BUNNY_CDN_URL}/${filePath}`
}

async function reformatImage(buffer) {
  // Trim fond blanc/transparent
  const trimmed = await sharp(buffer).trim().toBuffer()

  // Resize pour tenir dans 1000x1000
  const resized = await sharp(trimmed)
    .resize(1000, 1000, { fit: 'inside' })
    .toBuffer()

  const meta = await sharp(resized).metadata()
  const w = meta.width || 1000
  const h = meta.height || 1000

  // Centrer dans 1200x1200 + retouches
  const final = await sharp(resized)
    .extend({
      top: Math.floor((1200 - h) / 2),
      bottom: Math.ceil((1200 - h) / 2),
      left: Math.floor((1200 - w) / 2),
      right: Math.ceil((1200 - w) / 2),
      background: { r: 255, g: 255, b: 255 }
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .modulate({ brightness: 1.08, saturation: 1.20 })
    .gamma(1.05)
    .sharpen({ sigma: 1.5 })
    .png({ quality: 90 })
    .toBuffer()

  return final
}

function isDetoured(url) {
  if (!url) return false
  // Seulement les images Bunny qui sont détourées
  if (!url.includes(BUNNY_CDN_URL)) return false
  // Les photos "conserved" ou "formatted" ne sont PAS détourées
  if (url.includes('conserved_') || url.includes('formatted_') || url.includes('crop_')) return false
  // Les photos "detoured" ou "edited" ou "rotated" SONT détourées
  return url.includes('detoured_') || url.includes('edited_')
}

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN — rien ne sera modifié\n' : '🚀 MODE APPLY — modifications en cours\n')

  if (!BUNNY_API_KEY) {
    console.error('❌ BUNNY_API_KEY manquante. Lance avec : BUNNY_API_KEY=xxx node scripts/reformat-detoured.js')
    process.exit(1)
  }

  const snapshot = await db.collection('produits').get()
  console.log(`📦 ${snapshot.size} produits trouvés\n`)

  let processed = 0, skipped = 0, errors = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const sku = data.sku || doc.id
    const updates = {}

    for (const field of ['face', 'dos']) {
      const url = data.photos?.[field]
      
      if (!isDetoured(url)) {
        continue
      }

      try {
        console.log(`  📸 [${sku}] ${field}: ${url}`)

        if (DRY_RUN) {
          console.log(`     → SERAIT reformaté`)
          processed++
          continue
        }

        const buffer = await downloadImage(url)
        const reformatted = await reformatImage(buffer)

        const timestamp = Date.now()
        const random = Math.random().toString(36).substring(2, 8)
        const newPath = `produits/reformat_${timestamp}_${random}.png`
        const newUrl = await uploadToBunny(reformatted, newPath)

        updates[`photos.${field}`] = newUrl
        console.log(`     ✅ → ${newUrl}`)
        processed++
      } catch (err) {
        console.log(`     ❌ ${err.message}`)
        errors++
      }
    }

    if (!DRY_RUN && Object.keys(updates).length > 0) {
      await db.collection('produits').doc(doc.id).update(updates)
    }
  }

  console.log('\n========================================')
  console.log(`✅ Reformatés: ${processed}`)
  console.log(`❌ Erreurs: ${errors}`)
  if (DRY_RUN) console.log('\n👆 C\'était un DRY RUN. Relance avec --apply pour appliquer.')
}

main().catch(console.error)