import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
const WANT = ['IP65','IP204','IP25_CO05']
const pick = d => (d.photos?.face) || (Array.isArray(d.imageUrls) && d.imageUrls[0]) || d.imageUrl || null
for (const sku of WANT) {
  const snap = await db.collection('produits').where('sku','==',sku).limit(1).get()
  if (snap.empty) { console.log(sku, '❌ introuvable'); continue }
  const d = snap.docs[0].data()
  console.log('=== '+sku+' ===')
  console.log('  imageUrl   :', d.imageUrl||'-')
  console.log('  photos.face:', d.photos?.face||'-')
  console.log('  imageUrls0 :', (Array.isArray(d.imageUrls)&&d.imageUrls[0])||'-')
  console.log('  -> best    :', pick(d))
  console.log('  updatedAt  :', d.updatedAt?.toDate?.()?.toISOString?.() || d.updatedAt || '-')
}
process.exit(0)
