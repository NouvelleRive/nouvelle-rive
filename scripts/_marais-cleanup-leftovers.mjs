import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const A="\nAmbiance pavés, esprit village, et une vraie densité de friperies au kilo, de dépôts-ventes et de vintage de créateur."
const B="Un Marais au rythme doux — cafés et restos cosy, concept stores, galeries d'art et vintage. "
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  if(a.body.includes(A)){ a.body=a.body.replace(A,''); console.log('OK leftover A retiré') } else console.log('A introuvable')
  if(a.body.includes(B)){ a.body=a.body.replace(B,''); console.log('OK leftover B retiré') } else console.log('B introuvable')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
