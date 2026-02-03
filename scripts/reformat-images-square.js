//mettre en format carré toutes les images

require('dotenv').config({ path: '../.env.local' })
const admin = require('firebase-admin')
const https = require('https')
const http = require('http')
const sharp = require('sharp')

// Firebase config
const serviceAccount = require('./firebase-service-account.json')
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

// Bunny config
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || 'nouvellerive'
const BUNNY_API_KEY = process.env.BUNNY_API_KEY || '26a0a715-8178-492a-b7f062ba4e09-786a-46b4'
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL || 'https://nouvellerive.b-cdn.net'

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode))
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function uploadToBunny(buffer, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'storage.bunnycdn.com',
      port: 443,
      path: '/' + BUNNY_STORAGE_ZONE + '/' + path,
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_API_KEY,
        'Content-Type': 'image/png',
        'Content-Length': buffer.length
      }
    }
    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          resolve(BUNNY_CDN_URL + '/' + path)
        } else {
          reject(new Error('Upload failed: ' + res.statusCode))
        }
      })
    })
    req.on('error', reject)
    req.write(buffer)
    req.end()
  })
}

async function isSquare(buffer) {
  const meta = await sharp(buffer).metadata()
  return meta.width === meta.height
}

async function reformatToSquare(buffer) {
  const resized = await sharp(buffer)
    .resize(960, 960, { fit: 'inside' })
    .toBuffer()
  
  return sharp(resized)
    .resize(1200, 1200, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png({ quality: 90 })
    .toBuffer()
}

async function processImage(url, productId, suffix) {
  try {
    const buffer = await downloadImage(url)
    
    // FORCE le reformatage de toutes les images (plus de check isSquare)
    const squareBuffer = await reformatToSquare(buffer)
    
    // Upload
    const timestamp = Date.now()
    const path = `produits/${productId}_${suffix}_${timestamp}.png`
    const newUrl = await uploadToBunny(squareBuffer, path)
    
    console.log('    ✅ Reformaté')
    return newUrl
  } catch (err) {
    console.log('    ❌ Erreur:', err.message)
    return null
  }
}

async function main() {
  console.log('🔄 Reformatage des images en carré 1200x1200\n')
  
  const snap = await db.collection('produits').get()
  console.log(`📦 ${snap.size} produits\n`)
  
  let processed = 0
  let updated = 0
  
  for (const doc of snap.docs) {
    const data = doc.data()
    const updates = {}
    let hasUpdates = false
    
    console.log(`[${data.sku || doc.id}] ${(data.nom || '').substring(0, 40)}`)
    
    // imageUrl
    if (data.imageUrl && data.imageUrl.includes('b-cdn.net')) {
      console.log('  → imageUrl')
      const newUrl = await processImage(data.imageUrl, doc.id, 'main')
      if (newUrl) {
        updates.imageUrl = newUrl
        hasUpdates = true
      }
    }
    
    // imageUrls
    if (data.imageUrls?.length > 0) {
      const newUrls = []
      for (let i = 0; i < data.imageUrls.length; i++) {
        const url = data.imageUrls[i]
        if (url && url.includes('b-cdn.net')) {
          console.log(`  → imageUrls[${i}]`)
          const newUrl = await processImage(url, doc.id, `img${i}`)
          newUrls.push(newUrl || url)
        } else {
          newUrls.push(url)
        }
      }
      if (newUrls.some((u, i) => u !== data.imageUrls[i])) {
        updates.imageUrls = newUrls
        hasUpdates = true
      }
    }
    
    // photos.face
    if (data.photos?.face && data.photos.face.includes('b-cdn.net')) {
      console.log('  → photos.face')
      const newUrl = await processImage(data.photos.face, doc.id, 'face')
      if (newUrl) {
        updates['photos.face'] = newUrl
        hasUpdates = true
      }
    }
    
    // photos.dos
    if (data.photos?.dos && data.photos.dos.includes('b-cdn.net')) {
      console.log('  → photos.dos')
      const newUrl = await processImage(data.photos.dos, doc.id, 'dos')
      if (newUrl) {
        updates['photos.dos'] = newUrl
        hasUpdates = true
      }
    }
    
    // Sauvegarder
    if (hasUpdates) {
      await db.collection('produits').doc(doc.id).update(updates)
      updated++
    }
    
    processed++
  }
  
  console.log('\n========================================')
  console.log(`✅ Terminé: ${updated} produits mis à jour sur ${processed}`)
}

main().catch(console.error)