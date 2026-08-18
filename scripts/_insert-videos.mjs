import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const V='https://nouvellerive.b-cdn.net/videos/'
const UPCY = [
  `![Inès Pineau — upcycling](${V}DSF3XLMDEds-fs-1778414142867.mp4)`,
  `![Digger Sister — upcycling](${V}DVl6SB7goux-fs-1778414097221.mp4)`,
  `![Tête d'Orange — upcycling](${V}DGQaHDws64M-fs-1778414306737.mp4)`,
].join('\n\n')
const OKALIS = [
  `![Okalis — régénération](${V}DOsXgb2iGlm-fs-1779289990707.mp4)`,
  `![Okalis — régénération](${V}DWHTANOiLIk-fs-1779290003538.mp4)`,
].join('\n\n')
const SAVOIR = ["d'où l'intérêt de prolonger l'existant.","d'où l'intérêt de prolonger l'existant. Comme l'upcycling, la régénération est un vrai savoir-faire : il faut maîtriser la matière pour lui redonner vie sans la gâcher."]

const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='vintage-upcycle-regenere-difference'){
  let b=a.body
  // savoir-faire (une fois)
  if(!b.includes('un vrai savoir-faire') && b.includes(SAVOIR[0])) b=b.replace(SAVOIR[0],SAVOIR[1])
  // vidéos upcyclé avant "## Upcyclé vs régénéré"
  if(!b.includes('DSF3XLMDEds')){ const i=b.indexOf('## Upcyclé vs régénéré'); if(i>-1) b=b.slice(0,i)+UPCY+'\n\n'+b.slice(i) }
  // vidéos Okalis avant "## En termes d'impact"
  if(!b.includes('DOsXgb2iGlm')){ const i=b.indexOf("## En termes d'impact"); if(i>-1) b=b.slice(0,i)+OKALIS+'\n\n'+b.slice(i) }
  a.body=b
  console.log('✓ vidéos + savoir-faire insérés')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
