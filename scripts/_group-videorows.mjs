import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='vintage-upcycle-regenere-difference'){
  let b=a.body, prev
  // join vidéo→vidéo consécutives (ligne vide -> simple retour) tant qu'il en reste
  do { prev=b; b=b.replace(/(\.mp4\))\n\n(!\[[^\]]*\]\([^)]+\.mp4\))/g,'$1\n$2') } while(b!==prev)
  a.body=b
  console.log('✓ vidéos groupées en rangées')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
