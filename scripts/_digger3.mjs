import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
// par modele
for (const champ of ['modele']) for (const v of ['Ana','Ajar','Habi','ANA','AJAR','HABI']) {
  const s = await db.collection('produits').where(champ,'==',v).limit(3).get()
  if(!s.empty) console.log(champ+'="'+v+'":', s.size, '| SKU:', s.docs.map(d=>d.data().sku).join(','), '| marque:', s.docs[0].data().marque)
}
// scan marques distinctes contenant sister/digger via nom
const snap = await db.collection('produits').orderBy('marque').startAt('D').endAt('E').get()
const marques=new Set(); snap.forEach(d=>{const m=d.data().marque; if(m&&/sist|digg/i.test(m))marques.add(m)})
console.log('marques D* ~digger/sister:', [...marques].join(' | ') || 'aucune')
process.exit(0)
