import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
// ordre de la liste utilisatrice, à partir du 26/08
const ORDER = [
  'comment-reconnaitre-un-vrai-sac-chanel',
  'comment-on-sauve-la-planete-grace-au-vintage-en-chiffres',
  'quels-articles-faut-il-acheter-vintage-en-priorite',
  'comment-reconnaitre-un-vrai-trench-burberry',
  'le-tour-des-fripes-ideal-dans-le-marais',
  'comment-monter-sa-boite-dans-le-vintage',
  'comment-upcycler-un-bijou',
  'les-jeunes-creatrices-les-plus-talentueuses-du-moment',
  'quel-sac-choisir-pour-un-premier-achat-de-luxe',
  'quels-sacs-de-luxe-sont-de-bons-investissements',
  'mon-placard-vs-le-cac40-le-vintage-comme-investissement',
]
const dOf=(i)=>{ const d=new Date(Date.UTC(2026,7,26)); d.setUTCDate(d.getUTCDate()+i); return d.toISOString().slice(0,10) }
const dates=Object.fromEntries(ORDER.map((s,i)=>[s,dOf(i)]))
const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get(); const articles=snap.data().articles
for(const a of articles) if(dates[a.slug]) a.date=dates[a.slug]
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
for(const a of articles.filter(x=>x.date).sort((x,y)=>x.date.localeCompare(y.date))) console.log(`  ${a.date} · ${a.slug}`)
process.exit(0)
