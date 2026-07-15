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

const allPs = await db.collection('produits').where('trigramme', '==', 'PS').get()
const sorted = allPs.docs
  .map(d => ({ id: d.id, data: d.data() }))
  .sort((a, b) => (b.data.createdAt?.toMillis?.() || 0) - (a.data.createdAt?.toMillis?.() || 0))

console.log(`--- 15 derniers produits PS ---`)
sorted.slice(0, 15).forEach(d => {
  const data = d.data
  const created = data.createdAt?.toDate?.()?.toISOString?.().slice(0, 10) || 'n/a'
  console.log(`${(data.sku || '?').padEnd(10)} chineurUid="${data.chineurUid || ''}" chineur="${data.chineur || ''}" created=${created}`)
})

const withoutUid = allPs.docs.filter(d => !d.data().chineurUid)
const otherUid = allPs.docs.filter(d => d.data().chineurUid && d.data().chineurUid !== 'personal-seller')
console.log(`\n--- Total PS: ${allPs.docs.length} ---`)
console.log(`Sans chineurUid: ${withoutUid.length}`)
console.log(`chineurUid ≠ personal-seller: ${otherUid.length}`)
if (otherUid.length) {
  console.log('Exemples:')
  otherUid.slice(0, 5).forEach(d => {
    const data = d.data()
    console.log(`  ${data.sku} → chineurUid="${data.chineurUid}"`)
  })
}
if (withoutUid.length) {
  console.log('SKUs sans chineurUid:')
  withoutUid.slice(0, 10).forEach(d => console.log(`  ${d.data().sku}`))
}
process.exit(0)
