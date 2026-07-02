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

// Trouve la chineuse PS
const chSnap = await db.collection('chineuse').get()
const psChineuses = chSnap.docs.filter(d => {
  const t = (d.data().trigramme || '').toUpperCase()
  return t === 'PS'
})
console.log('--- Chineuses PS ---')
psChineuses.forEach(d => {
  const data = d.data()
  console.log(`docId="${d.id}"  trigramme=${data.trigramme}  email=${data.email}  emails=${JSON.stringify(data.emails || [])}`)
})

// Trouve un produit PS pour voir les champs chineur* présents
console.log('\n--- 3 produits PS (échantillon) ---')
const prodSnap = await db.collection('produits').where('trigramme', '==', 'PS').limit(3).get()
prodSnap.docs.forEach(d => {
  const data = d.data()
  console.log({
    id: d.id,
    sku: data.sku,
    chineur: data.chineur,
    chineurUid: data.chineurUid,
    chineurSlug: data.chineurSlug,
    trigramme: data.trigramme,
  })
})
process.exit(0)
