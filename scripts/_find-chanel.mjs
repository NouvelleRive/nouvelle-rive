import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const db = getFirestore()
const S=(v)=>Array.isArray(v)?v.join(' '):String(v??'')
const snap = await db.collection('produits').select('sku','nom','marque','imageUrls').limit(6000).get()
let url=null
for(const doc of snap.docs){ const p=doc.data()
  if(S(p.marque).toLowerCase().includes('chanel') && S(p.nom).toLowerCase().includes('cabas') && /motif/.test(S(p.nom).toLowerCase())){
    url=Array.isArray(p.imageUrls)?p.imageUrls[0]:null
    console.log('MATCH', S(p.sku), '|', S(p.nom).slice(0,45), '|', url); if(url) break
  }
}
if(!url){ console.log('❌ Chanel cabas introuvable'); process.exit(0) }
const ref = db.collection('siteConfig').doc('_journal')
const s2 = await ref.get(); const articles=s2.data().articles
const line=`![Cabas à motifs — Chanel](${url})`
for(const a of articles) if(a.slug==='reconnaitre-vrai-sac-luxe-vintage'){
  for(const [body,head] of [['body','## Faut-il faire authentifier'],['bodyEn','## Should you have your bag authenticated']]){
    if(a[body] && !a[body].includes(url)){ const i=a[body].indexOf(head); if(i>-1){ a[body]=a[body].slice(0,i)+line.replace('Chanel]',(body==='bodyEn'?'Patterned tote — Chanel]':'Chanel]'))+'\n\n'+a[body].slice(i) } }
  }
  console.log('✓ Chanel insérée')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
