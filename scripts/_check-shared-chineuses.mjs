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

// Chineuses avec plusieurs emails
const chSnap = await db.collection('chineuse').get()
console.log('--- Chineuses avec 2+ emails ---')
const shared = []
chSnap.docs.forEach(d => {
  const data = d.data()
  const emails = data.emails || []
  if (emails.length >= 2) {
    shared.push({ id: d.id, tri: data.trigramme, emails })
    console.log(`docId="${d.id}"  tri=${data.trigramme}  emails=${JSON.stringify(emails)}`)
  }
})

// Pour chacune, combien de produits ont chineurUid ≠ docId ?
console.log('\n--- Produits mal linkés par compte partagé ---')
for (const c of shared) {
  const prodSnap = await db.collection('produits').where('trigramme', '==', c.tri).get()
  const total = prodSnap.docs.length
  const bad = prodSnap.docs.filter(d => d.data().chineurUid && d.data().chineurUid !== c.id)
  const noUid = prodSnap.docs.filter(d => !d.data().chineurUid)
  console.log(`${c.tri} (docId=${c.id}) : total=${total}  chineurUid≠docId=${bad.length}  sans chineurUid=${noUid.length}`)
}
process.exit(0)
