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

const chSnap = await db.collection('chineuse').get()
const smallBatchTrig = new Set()
chSnap.docs.forEach(d => {
  if (d.data().stockType === 'smallBatch') smallBatchTrig.add((d.data().trigramme || '').toUpperCase())
})

const snap = await db.collection('produits').where('statut', '==', 'supprime').get()
const byTrig = new Map()
snap.docs.forEach(d => {
  const p = d.data()
  const trig = (p.trigramme || '').toUpperCase()
  if (smallBatchTrig.has(trig)) return
  const hasIds = !!(p.variationId || p.catalogObjectId || p.itemId)
  if (!hasIds) return
  const sku = (p.sku || d.id).toUpperCase()
  if (!byTrig.has(trig)) byTrig.set(trig, [])
  byTrig.get(trig).push(sku)
})

const trigs = [...byTrig.keys()].sort()
console.log(`Total : ${[...byTrig.values()].reduce((s, a) => s + a.length, 0)}`)
for (const trig of trigs) {
  const skus = byTrig.get(trig).sort()
  console.log(`\n=== ${trig} (${skus.length}) ===`)
  console.log(skus.join(', '))
}
process.exit(0)
