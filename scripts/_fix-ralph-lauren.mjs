import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const snap = await db.collection('produits').where('marque', '==', 'Ralph Laure').get()
console.log(`→ ${snap.size} produits à corriger`)
for (const d of snap.docs) {
  await d.ref.update({ marque: 'Ralph Lauren' })
  console.log(`✅ ${d.data().sku}`)
}
process.exit(0)
