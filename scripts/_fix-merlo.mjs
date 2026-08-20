import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
async function geo(q){ const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,{headers:{'User-Agent':'nouvellerive-journal/1.0'}}); const d=await r.json(); return d[0]?{lat:+d[0].lat,lng:+d[0].lon}:null }
let c=await geo('57 rue de Turenne 75003 Paris') || {lat:48.8588,lng:2.3644}
console.log('Merlo:', c)
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  let m=(a.mapMarkers||[]).filter(x=>x.name!=='Merlot'&&x.name!=='Merlo')
  m.push({name:'Merlo',kind:'cafe',lat:c.lat,lng:c.lng})
  a.mapMarkers=m; console.log('total pins:', m.length)
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
