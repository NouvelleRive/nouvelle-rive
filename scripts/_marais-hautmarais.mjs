import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const R=[
  ["de l'autre le Haut Marais, plus chic et pointu.", "de l'autre le Haut Marais, ses concept stores et ses galeries."],
  ["Ambiance : plus chic, plus calme, plus pointu. Place aux concept stores, aux archives de créateurs et au vintage de luxe. Les prix montent, la curation aussi — c'est le Marais des connaisseuses et connaisseurs, celui où l'on chine sans fouiller.",
   "Ambiance : concept stores, galeries d'art, archives de créateurs et vintage de luxe. Un Marais plus récent, tourné mode et design, où l'on chine sans fouiller."],
]
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  for(const [o,n] of R){ if(a.body.includes(o)){ a.body=a.body.split(o).join(n); console.log('OK remplace:', o.slice(0,40)) } else console.log('ancre absente:', o.slice(0,40)) }
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
