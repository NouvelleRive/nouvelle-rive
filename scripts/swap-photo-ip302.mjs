// Promeut la 1re photo de "details" en photo "face" pour une liste de SKUs.
// Usage : node scripts/swap-photo-ip302.mjs           → preview
//         node scripts/swap-photo-ip302.mjs --apply   → écrit en Firestore
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, 'firebase-service-account.json'), 'utf8')
)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const SKUS = ['IP302', 'IP303', 'IP304']
const APPLY = process.argv.includes('--apply')

for (const sku of SKUS) {
  console.log('═'.repeat(60))
  console.log(`SKU: ${sku}`)
  const snap = await db.collection('produits').where('sku', '==', sku).limit(1).get()
  if (snap.empty) {
    console.log('  ✗ aucun produit trouvé')
    continue
  }
  const doc = snap.docs[0]
  const data = doc.data()
  console.log(`  id : ${doc.id}`)
  console.log(`  nom: ${data.nom}`)

  const photos = { ...(data.photos || {}) }
  const details = Array.isArray(photos.details) ? [...photos.details] : []
  const oldFace = photos.face || ''

  console.log(`  AVANT — face: ${oldFace.slice(-50) || '(vide)'}`)
  console.log(`         details[0]: ${details[0]?.slice(-50) || '(vide)'}`)

  const newFace = details.shift()
  if (!newFace) {
    console.log('  ⚠ pas de details à promouvoir, skip')
    continue
  }
  const newDetails = oldFace ? [oldFace, ...details] : details
  photos.face = newFace
  photos.details = newDetails

  console.log(`  APRÈS — face: ${newFace.slice(-50)}`)
  console.log(`         details[0]: ${newDetails[0]?.slice(-50) || '(vide)'}`)

  if (!APPLY) continue

  const newImageUrls = []
  const push = (u) => { if (u && !newImageUrls.includes(u)) newImageUrls.push(u) }
  push(photos.face)
  push(photos.faceOnModel)
  push(photos.dos)
  push(photos.dosOnModel)
  for (const u of (photos.details || [])) push(u)

  await db.collection('produits').doc(doc.id).update({ photos, imageUrls: newImageUrls })
  console.log('  ✓ écrit Firestore')
}

console.log('═'.repeat(60))
if (!APPLY) console.log('▶ Mode preview. Pour appliquer : node scripts/swap-photo-ip302.mjs --apply')
