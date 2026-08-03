import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') }) })
const db = getFirestore()
const pick = d => (d.photos?.face) || (Array.isArray(d.imageUrls) && d.imageUrls[0]) || d.imageUrl || null
for (const sku of ['AGE213','AGE211']) {
  const s = await db.collection('produits').where('sku','==',sku).limit(1).get()
  console.log(sku, s.empty ? '❌ introuvable' : (pick(s.docs[0].data()) ? '✓ '+pick(s.docs[0].data()) : '❌ pas image'))
}
process.exit(0)
