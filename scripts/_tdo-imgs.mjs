import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
import { writeFileSync } from 'fs'
config({ path: new URL("../.env.local", import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
const WANT = "TDO69 TDO66 TDO65 TDO57 TDO40 TDO27 TDO18 TDO14 TDO46 TDO60 TDO13 TDO61 TDO53 TDO2 TDO48 TDO44 TDO45 TDO35 TDO59".split(" ")
const pick = d => (d.photos?.face) || (Array.isArray(d.imageUrls) && d.imageUrls[0]) || d.imageUrl || null
const out = []
for (const sku of WANT) {
  const snap = await db.collection('produits').where('sku','==',sku).limit(1).get()
  if (snap.empty) { console.log(sku, '❌ introuvable'); continue }
  const img = pick(snap.docs[0].data())
  if (img) { out.push(img); console.log(sku, 'ok') } else console.log(sku, '❌ pas image')
}
writeFileSync(process.argv[2], JSON.stringify(out))
console.log('→', out.length, '/', WANT.length, 'images')
process.exit(0)
