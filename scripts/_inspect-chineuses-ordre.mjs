import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })

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
const snap = await db.collection('chineuse').orderBy('ordre', 'asc').get()
console.log('Ordre | id | nom')
console.log('---')
snap.docs.forEach(d => {
  const data = d.data()
  console.log(`${(data.ordre ?? '?').toString().padStart(3)} | ${d.id.padEnd(20)} | ${data.nom || '(no nom)'}`)
})
process.exit(0)
