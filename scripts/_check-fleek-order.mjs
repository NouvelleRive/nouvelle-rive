import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const orderId = '154621'
const snap = await db.collection('produits').where('achatOrderId', '==', orderId).get()
console.log(`→ ${snap.size} produits avec achatOrderId=${orderId}`)
snap.forEach(d => {
  const x = d.data()
  console.log(`   ${d.id} — sku=${x.sku} titre=${x.achatTitreOriginal || x.nom} prov=${x.achatProvenance}`)
})

const snap2 = await db.collection('produits').where('source', '==', 'achat-fleek').get()
console.log(`\n→ ${snap2.size} produits source=achat-fleek (tous ordres confondus)`)
snap2.forEach(d => {
  const x = d.data()
  console.log(`   ${d.id} — sku=${x.sku} orderId=${x.achatOrderId} titre=${x.achatTitreOriginal || x.nom}`)
})
process.exit(0)
