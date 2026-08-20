import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const g=(q)=>`https://www.google.com/maps/search/${encodeURIComponent(q)}`
const SULLY=g('Hôtel de Sully 62 rue Saint-Antoine Paris')
async function geo(q){ const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,{headers:{'User-Agent':'nouvellerive-journal/1.0'}}); const d=await r.json(); return d[0]?{lat:+d[0].lat,lng:+d[0].lon}:null }
const c=await geo('Hôtel de Sully 62 rue Saint-Antoine 75004 Paris')
console.log('géocode Sully:', c)
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  let b=a.body
  // 1) sur le trajet (section 3), après place des Vosges
  const R1="au moindre rayon de soleil."
  if(b.includes(R1) && !b.includes('hôtel de Sully')){ b=b.replace(R1, R1+` Juste à côté, jetez un œil à l'[hôtel de Sully](${SULLY}), superbe hôtel particulier Renaissance relié à la place par un petit passage.`); console.log('OK trajet') }
  // 2) dans à voir, après la place des Vosges
  const R2="La [place des Vosges](https://www.google.com/maps/search/Place%20des%20Vosges%20Paris) : la plus ancienne place royale de Paris, ses arcades et son jardin."
  if(b.includes(R2) && !b.includes('hôtel de Sully) : magnifique')){ b=b.replace(R2, R2+`\n- L'[hôtel de Sully](${SULLY}) : magnifique hôtel particulier Renaissance, relié à la place des Vosges par un passage.`); console.log('OK à voir') }
  a.body=b
  // 3) marker
  if(c){ const m=a.mapMarkers||[]; if(!m.find(x=>x.name==='Hôtel de Sully')){ m.push({name:'Hôtel de Sully',kind:'lieu',lat:c.lat,lng:c.lng}); a.mapMarkers=m; console.log('OK pin, total', m.length) } }
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
