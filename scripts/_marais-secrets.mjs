import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const OLD="épargné par les grands travaux du baron Haussmann."
const NEW="épargné par la grande transformation du baron Haussmann, entamée en 1853. Le Marais garde ainsi mille secrets du Paris d'autrefois."
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  if(a.body.includes('mille secrets')){ console.log('· déjà présent') }
  else if(a.body.includes(OLD)){ a.body=a.body.replace(OLD,NEW); console.log('✓ 1853 + secrets ajoutés') }
  else console.log('✗ ancre non trouvée')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
