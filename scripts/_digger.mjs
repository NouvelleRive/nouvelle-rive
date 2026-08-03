import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
// chercher par marque contenant "digger" (scan léger sur marque via égalités probables)
const cands = ['Digger Sister','Diggers Sister','DIGGER SISTER','Digger sister','digger sister']
for (const m of cands) {
  const s = await db.collection('produits').where('marque','==',m).limit(3).get()
  if(!s.empty){ console.log('marque="'+m+'" ->', s.size, 'ex. SKU:', s.docs.map(d=>d.data().sku).join(', ')) }
}
process.exit(0)
