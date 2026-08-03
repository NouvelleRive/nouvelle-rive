import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { writeFileSync } from 'fs'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') }) })
const db = getFirestore()
const WANT = ['AGE148','AGE153','AGE154','AGE190','AGE193','AGE199','AGE231','AGE135','AGE55','AGE77']
const pick = d => (d.photos?.face) || (Array.isArray(d.imageUrls) && d.imageUrls[0]) || d.imageUrl || null
const out = []
for (const sku of WANT) {
  const snap = await db.collection('produits').where('sku', '==', sku).limit(1).get()
  if (snap.empty) { console.log(sku, '❌ introuvable'); continue }
  const d = snap.docs[0].data()
  const img = pick(d)
  console.log(sku, '|', img ? '✓' : '❌ pas image', d.marque||'')
  if (img) out.push(img); else out.push(null)
}
writeFileSync('/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad/age-imgs.json', JSON.stringify(out))
console.log('\n→', out.filter(Boolean).length, '/10 images')
process.exit(0)
