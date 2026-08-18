import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
const snap=await db.collection('chineuse').get()
for(const doc of snap.docs){ const d=doc.data(); const s=(doc.id+' '+(d.nom||'')+' '+(d.slug||'')).toLowerCase()
  if(s.includes('aer')||s.includes('aér')) console.log('id:',doc.id,'| nom:',d.nom,'| slug:',d.slug,'| videos:',(d.videos||[]).length)
}
process.exit(0)
