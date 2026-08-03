import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
// plage marque commençant par "Digg"
for (const p of ['Digg','digg','DIGG']) {
  const s = await db.collection('produits').orderBy('marque').startAt(p).endAt(p+'￿').limit(10).get()
  if(!s.empty){ const skus=[...new Set(s.docs.map(d=>d.data().sku))]; const marques=[...new Set(s.docs.map(d=>d.data().marque))]
    console.log('prefixe "'+p+'": marques=',JSON.stringify(marques),'| SKUs ex:',skus.slice(0,6).join(', ')) }
}
process.exit(0)
