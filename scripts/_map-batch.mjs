import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
async function geo(q){ const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,{headers:{'User-Agent':'nouvellerive-journal/1.0'}}); const d=await r.json(); return d[0]?{lat:+d[0].lat,lng:+d[0].lon}:null }
const anna = await geo('Chez Hanna 54 rue des Rosiers Paris') || await geo('rue des Rosiers 75004 Paris') || {lat:48.8575,lng:2.3588}
await new Promise(r=>setTimeout(r,1100))
const solere = await geo('rue des Écouffes 75004 Paris') || {lat:48.8567,lng:2.3585}
console.log('Chez Anna:',anna,'| Système Solère:',solere)
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  let m=a.mapMarkers||[]
  m=m.filter(x=>x.name!=='Synagogue rue Pavée')  // retrait syna
  const up=(name,kind,c)=>{ const i=m.findIndex(x=>x.name===name); const p={name,kind,lat:c.lat,lng:c.lng}; if(i>=0)m[i]=p; else m.push(p) }
  up('Chez Anna','food',anna)
  up('Système Solère','fripe',solere)
  a.mapMarkers=m
  console.log('total pins:', m.length)
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
