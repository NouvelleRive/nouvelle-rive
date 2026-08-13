import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync('./scripts/firebase-service-account.json', 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()
const targets = ['STRC26','STRC22']
// direct docId
for (const t of targets) {
  const s = await db.collection('produits').doc(t).get()
  console.log(`produits/${t} exists:`, s.exists)
}
// scan produits for any sku variant (space/case)
const all = await db.collection('produits').get()
console.log('total produits:', all.size)
all.forEach(d=>{
  const sku=(d.data().sku||'').toString().trim().toUpperCase()
  if(sku==='STRC22'||sku==='STRC26') console.log('MATCH variant produits:', d.id, JSON.stringify(d.data().sku))
})
// check ventes collection
for (const t of targets) {
  const v = await db.collection('ventes').where('sku','==',t).get()
  console.log(`ventes sku ${t}:`, v.size)
}
process.exit(0)
