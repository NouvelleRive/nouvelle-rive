import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
async function geo(q){ const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,{headers:{'User-Agent':'nouvellerive-journal/1.0'}}); const d=await r.json(); return d[0]?{lat:+d[0].lat,lng:+d[0].lon}:null }
let c=await geo('Saint-Paul metro station Paris 75004')
// station Saint-Paul (Le Marais, ligne 1) : coords connues
if(!c || c.lat>48.865) c={lat:48.85528,lng:2.36075}
console.log('coords Saint-Paul:', c)
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  const m=a.mapMarkers||[]; const i=m.findIndex(x=>x.name==='Métro Saint-Paul')
  const pin={name:'Métro Saint-Paul',kind:'lieu',lat:c.lat,lng:c.lng}
  if(i>=0) m[i]=pin; else m.push(pin)
  a.mapMarkers=m; console.log('total pins:', m.length)
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
