// Vérifie que le blob produits-all contient bien les nouveaux prix NR
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { gunzipSync } from 'zlib'
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
const file = bucket.file('_cache/produits-all.json.gz')
const [meta] = await file.getMetadata()
console.log(`Blob updated: ${meta.updated}`)

const [buf] = await file.download({ validation: false })
let text
try { text = gunzipSync(buf).toString('utf8') } catch { text = buf.toString('utf8') }
const arr = JSON.parse(text)
console.log(`Blob contient ${arr.length} produits`)

for (const sku of ['NR123', 'NR120', 'NR119', 'NR94', 'NR92', 'NR37']) {
  const p = arr.find(x => x.raw.sku === sku)
  if (!p) { console.log(`${sku}: absent du blob`); continue }
  console.log(`${sku}: prix=${p.raw.prix} ancienPrix=${p.raw.ancienPrix} prixBaisseLe=${p.raw.prixBaisseLe?._seconds ? new Date(p.raw.prixBaisseLe._seconds * 1000).toISOString().slice(0,10) : '?'}`)
}
process.exit(0)
