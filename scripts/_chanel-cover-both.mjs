import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const db = getFirestore()
const S=(v)=>Array.isArray(v)?v.join(' '):String(v??'')
const snap = await db.collection('produits').select('sku','nom','marque','imageUrls').limit(6000).get()
const chanels=[]
for(const doc of snap.docs){ const p=doc.data()
  if(S(p.marque).toLowerCase().includes('chanel') && /sac|cabas|flap|matelass|timeless|classique/.test(S(p.nom).toLowerCase())){
    const u=Array.isArray(p.imageUrls)?p.imageUrls[0]:null
    if(u) chanels.push({sku:S(p.sku),nom:S(p.nom).slice(0,45),url:u})
  }
}
console.log('Chanels dispo:'); chanels.slice(0,10).forEach(c=>console.log('  ',c.sku,'|',c.nom))
// priorité : un matelassé/noir/timeless, sinon le premier
const pick = chanels.find(c=>/noir|matelass|timeless|classique/.test(c.nom.toLowerCase())) || chanels[0]
if(!pick){ console.log('❌ aucun sac Chanel'); process.exit(1) }
console.log('\n→ choisi:', pick.sku, pick.nom, '\n ', pick.url)
const ref = db.collection('siteConfig').doc('_journal')
const s2 = await ref.get(); const articles=s2.data().articles
for(const a of articles) if(['reconnaitre-vrai-sac-luxe-vintage','comment-reconnaitre-un-vrai-sac-chanel'].includes(a.slug)){ a.cover=pick.url; console.log('  ✓ cover set:',a.slug) }
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
