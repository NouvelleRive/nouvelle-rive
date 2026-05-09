// Re-crop l'image hero de l'iconique Lunettes Maki en carré centré (mêmes marges haut/bas)
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import sharp from 'sharp'
import https from 'https'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const BUNNY_STORAGE_ZONE = 'nouvellerive'
const BUNNY_API_KEY = '26a0a715-8178-492a-b7f062ba4e09-786a-46b4'
const BUNNY_CDN_URL = 'https://nouvellerive.b-cdn.net'

const ICONIQUE_ID = 'lunettes-maki-upcy'
const SOURCE_URL = 'https://nouvellerive.b-cdn.net/chineuses/maki-corp.jpg'
const DEST_PATH = `chineuses/maki-corp-centered-${Date.now()}.jpg`

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function upload(buffer, path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'storage.bunnycdn.com',
      port: 443,
      path: `/${BUNNY_STORAGE_ZONE}/${path}`,
      method: 'PUT',
      headers: { 'AccessKey': BUNNY_API_KEY, 'Content-Type': 'image/jpeg', 'Content-Length': buffer.length },
    }, (res) => {
      if (res.statusCode === 201) resolve(`${BUNNY_CDN_URL}/${path}`)
      else reject(new Error(`Upload failed: ${res.statusCode}`))
    })
    req.on('error', reject)
    req.write(buffer); req.end()
  })
}

console.log(`Téléchargement ${SOURCE_URL}…`)
const original = await download(SOURCE_URL)

const meta = await sharp(original).metadata()
console.log(`Image originale : ${meta.width}×${meta.height}`)

// Crop carré centré : si paysage, on coupe les côtés ; si portrait, on coupe haut+bas symétriquement
const size = Math.min(meta.width, meta.height)
const left = Math.floor((meta.width - size) / 2)
const top = Math.floor((meta.height - size) / 2)
console.log(`Crop ${size}×${size} à offset (${left}, ${top})`)

const cropped = await sharp(original)
  .extract({ left, top, width: size, height: size })
  .jpeg({ quality: 90 })
  .toBuffer()

const newUrl = await upload(cropped, DEST_PATH)
console.log(`✅ Uploaded : ${newUrl}`)

// Update Firestore
await db.collection('iconiques').doc(ICONIQUE_ID).update({ images: [newUrl] })
console.log(`✅ iconiques/${ICONIQUE_ID}.images mis à jour`)
process.exit(0)
