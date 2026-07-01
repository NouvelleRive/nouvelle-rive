import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sa = JSON.parse(readFileSync(resolve(__dirname, 'firebase-service-account.json'), 'utf8'))
initializeApp({ credential: cert(sa) })
const db = getFirestore()

// Forme canonique = exactement comme c'est écrit dans les iconiques.
const REWRITE = {
  'chanel': 'Chanel',
  "levi's": "Levi's",
  'burberry': 'Burberry',
  'hermès': 'Hermès',
  'hermes': 'Hermès',
}

const snap = await db.collection('produits').get()
let updated = 0
let batch = db.batch()
let inBatch = 0

for (const doc of snap.docs) {
  const m = (doc.data().marque || '').trim()
  if (!m) continue
  const target = REWRITE[m.toLowerCase()]
  if (target && target !== m) {
    batch.update(doc.ref, { marque: target })
    inBatch++
    updated++
    console.log(`  ${doc.data().sku || doc.id} : "${m}" → "${target}"`)
    if (inBatch >= 400) {
      await batch.commit()
      console.log(`  ↳ commit batch (${inBatch})`)
      batch = db.batch()
      inBatch = 0
    }
  }
}
if (inBatch > 0) await batch.commit()
console.log(`\n✅ ${updated} produits normalisés.`)
process.exit(0)
