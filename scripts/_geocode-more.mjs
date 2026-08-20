import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const NEW=[
  ['The Selection','26 rue de Poitou 75003 Paris','fripe'],
  ['Anashi','85 rue de Turenne 75003 Paris','fripe'],
  ['Nuovo','130 rue de Turenne 75003 Paris','fripe'],
  ['Kanelle Vintage','48 rue de Turenne 75003 Paris','fripe'],
  ['Revoir Vintage','12 rue Commines 75003 Paris','fripe'],
  ['Joho','14 rue des Écouffes 75004 Paris','cafe'],
  ['Merlot','57 rue de Turenne 75003 Paris','cafe'],
]
async function geo(q){
  const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,{headers:{'User-Agent':'nouvellerive-journal/1.0'}})
  const d=await r.json(); return d[0]?{lat:+d[0].lat,lng:+d[0].lon}:null
}
const add=[]
for(const [name,q,kind] of NEW){ const c=await geo(q); if(c){ add.push({name,kind,lat:c.lat,lng:c.lng}); console.log('✓',name,c.lat.toFixed(4),c.lng.toFixed(4)) } else console.log('✗',name); await new Promise(r=>setTimeout(r,1100)) }
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  const m=a.mapMarkers||[]
  for(const nm of add){ const i=m.findIndex(x=>x.name===nm.name); if(i>=0) m[i]=nm; else m.push(nm) }
  a.mapMarkers=m
  console.log('total pins:', m.length)
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
