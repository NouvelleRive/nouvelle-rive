import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const R=[
  ['## 1. Le Marais en général','## Bienvenue dans le Marais'],
  ['## 2. Les deux Marais','## Les deux Marais'],
  ['## 3. Le fripe trip : le parcours idéal','## Le fripe trip : le parcours idéal'],
  ['## 4. Où déjeuner','## Où déjeuner'],
  ['## 5. Où prendre un café','## Où prendre un café'],
]
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  for(const [o,n] of R){ if(a.body.includes(o)){ a.body=a.body.replace(o,n); console.log('OK',o,'->',n) } }
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
