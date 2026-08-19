import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get(); const articles=snap.data().articles
const P="Tout ce qu'on a acheté dans notre vie existe encore quelque part sur la planète. Ce n'est pas parce qu'on ne le voit plus qu'il n'existe plus."
for(const a of articles) if(a.slug==='vintage-upcycle-regenere-difference'){
  if(a.body.includes('> '+P)){ console.log('· déjà en citation'); break }
  if(a.body.includes(P)){ a.body=a.body.replace(P,'> '+P); console.log('✓ passage passé en citation bleue') }
  else console.log('✗ passage non trouvé')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
