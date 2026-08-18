import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const DATES = {
  'depot-vente-luxe-paris': '2026-08-18',
  'reconnaitre-vrai-sac-luxe-vintage': '2026-08-19',
  'vintage-upcycle-regenere-difference': '2026-08-20',
  'chiner-vintage-marais': '2026-08-21',
  'vintage-luxe-petit-prix': '2026-08-22',
  'vintage-plutot-que-fast-fashion': '2026-08-23',
  'pourquoi-detester-fast-fashion': '2026-08-24',
  'pourquoi-soutenir-jeunes-creatrices': '2026-08-25',
}
const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get()
const articles = snap.data().articles
for (const a of articles) if (DATES[a.slug]) a.date = DATES[a.slug]
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
for (const a of articles.filter(x=>x.body).sort((x,y)=>(x.date||'z').localeCompare(y.date||'z')))
  console.log(`  ${a.date||'(à programmer)'} · ${a.slug}`)
process.exit(0)
