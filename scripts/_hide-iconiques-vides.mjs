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

const snap = await db.collection('iconiques').get()
let hidden = 0
for (const doc of snap.docs) {
  const d = doc.data()
  const hasMarque = !!(d.marque && d.marque.trim())
  const hasTrigs = Array.isArray(d.chineuseTrigrammes) && d.chineuseTrigrammes.length > 0
  const hasCats = Array.isArray(d.categoriesIn) && d.categoriesIn.length > 0
  if (!hasMarque && !hasTrigs && !hasCats) {
    if (d.displayOnWebsite === false) {
      console.log(`  (déjà caché) ${d.nom}`)
      continue
    }
    await doc.ref.update({ displayOnWebsite: false })
    console.log(`  CACHÉ: ${d.nom}`)
    hidden++
  }
}
console.log(`\n✅ ${hidden} iconiques cachés. Re-active avec displayOnWebsite=true dans l'admin.`)
process.exit(0)
