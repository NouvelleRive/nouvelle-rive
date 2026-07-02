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
const snap = await db.collection('chineuse').where('trigramme', '==', 'DISI').limit(1).get()
if (snap.empty) {
  console.log('Aucune chineuse trouvée avec trigramme DISI')
} else {
  const data = snap.docs[0].data()
  console.log('id:', snap.docs[0].id)
  console.log('nom:', data.nom)
  console.log('trigramme:', data.trigramme)
  console.log('stockType:', data.stockType ?? '(non défini → défaut "unique")')
}
process.exit(0)
