import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const OLD="réputé pour son inclusivité — et le seul quartier de Paris à avoir conservé"
const NEW="réputé pour son inclusivité : son ouverture affichée à la communauté LGBTQ+ en a fait un lieu sûr et accueillant. C'est aussi le seul quartier de Paris à avoir conservé"
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  if(a.body.includes('LGBTQ+')){ console.log('deja present') }
  else if(a.body.includes(OLD)){ a.body=a.body.replace(OLD,NEW); console.log('OK LGBTQ+ lieu sur ajoute') }
  else console.log('ancre absente')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
