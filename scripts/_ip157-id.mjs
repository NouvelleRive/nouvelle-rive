import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
const snap = await db.collection('produits').where('sku','==','IP157').limit(1).get()
const d = snap.docs[0]
console.log('IP157 id:', d.id)
console.log('IP157 imageUrl:', d.data().imageUrl)
console.log('IP157 photos.face:', d.data().photos?.face)
process.exit(0)
