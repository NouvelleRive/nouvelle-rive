import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get()
const articles = snap.data().articles
let count=0
for (const a of articles) for (const k of ['title','description','body','titleEn','descriptionEn','bodyEn']) {
  if(typeof a[k]==='string' && a[k].includes('Nouvelle Rive')){ a[k]=a[k].split('Nouvelle Rive').join('NOUVELLE RIVE'); count++ }
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
const remain = articles.reduce((n,a)=>n+['title','description','body','titleEn','descriptionEn','bodyEn'].filter(k=>typeof a[k]==='string'&&a[k].includes('Nouvelle Rive')).length,0)
console.log(`✓ ${count} champs corrigés · reste "Nouvelle Rive": ${remain}`)
process.exit(0)
