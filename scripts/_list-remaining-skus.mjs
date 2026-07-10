import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}
const db = getFirestore()

// smallBatch trigrammes à exclure
const chSnap = await db.collection('chineuse').get()
const smallBatchTrig = new Set()
chSnap.docs.forEach(d => {
  if (d.data().stockType === 'smallBatch') smallBatchTrig.add((d.data().trigramme || '').toUpperCase())
})

const snap = await db.collection('produits').where('vendu', '==', true).get()
const skusByTrig = new Map()
snap.docs.forEach(d => {
  const p = d.data()
  const hasIds = !!(p.variationId || p.catalogObjectId || p.itemId)
  if (!hasIds) return
  const trig = (p.trigramme || '').toUpperCase()
  if (smallBatchTrig.has(trig)) return
  const sku = (p.sku || d.id).toUpperCase()
  if (!skusByTrig.has(trig)) skusByTrig.set(trig, [])
  skusByTrig.get(trig).push(sku)
})

const trigrammes = [...skusByTrig.keys()].sort()
console.log(`Trigrammes restants (${trigrammes.length}), total SKUs : ${[...skusByTrig.values()].reduce((s, a) => s + a.length, 0)}`)
console.log('')
for (const trig of trigrammes) {
  const skus = skusByTrig.get(trig).sort()
  console.log(`=== ${trig} (${skus.length}) ===`)
  console.log(skus.join(', '))
  console.log('')
}
process.exit(0)
