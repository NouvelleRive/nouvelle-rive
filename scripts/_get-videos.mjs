import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
for(const slug of ['ines-pineau','digger-sister']){
  let snap = await db.collection('chineuse').doc(slug).get()
  if(!snap.exists){ const q=await db.collection('chineuse').where('slug','==',slug).limit(1).get(); snap=q.docs[0] }
  if(!snap || !snap.exists){ console.log(slug,'→ introuvable'); continue }
  const d=snap.data()
  console.log('\n=== '+slug+' ('+(d.nom||d.name||'')+') ===')
  ;(d.videos||[]).forEach((v,i)=>console.log('  ['+i+']',v))
}
process.exit(0)
