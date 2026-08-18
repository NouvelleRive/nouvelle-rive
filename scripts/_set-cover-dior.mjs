import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const db = getFirestore()
const S=(v)=>Array.isArray(v)?v.join(' '):String(v??'')
const snap = await db.collection('produits').select('sku','nom','marque','imageUrls').limit(5000).get()
let found=null
for (const doc of snap.docs){
  const p=doc.data()
  if(S(p.sku).toUpperCase().includes('PS206') || S(p.nom).toLowerCase().includes('miss dior')){
    const url=Array.isArray(p.imageUrls)?p.imageUrls[0]:null
    console.log('MATCH:', S(p.sku), '|', S(p.nom).slice(0,40), '|', url)
    if(S(p.sku).toUpperCase()==='PS206' && url){ found=url; break }
    if(!found && url) found=url
  }
}
if(!found){ console.log('❌ image introuvable'); process.exit(1) }
const ref = db.collection('siteConfig').doc('_journal')
const s2 = await ref.get(); const articles=s2.data().articles
for(const a of articles) if(a.slug==='reconnaitre-vrai-sac-luxe-vintage'){ a.cover=found; console.log('✓ cover =',found) }
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
