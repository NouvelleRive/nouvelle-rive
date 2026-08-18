import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const db = getFirestore()
const S=(v)=>Array.isArray(v)?v.join(' '):String(v??'')
// SKU -> légende
const WANT = [
  ['PS206','Sac Miss Dior noir — Dior'],
  ['PS210','Sac 30 Montaigne — Dior'],
  ['PS215','Sac Lady Dior en soie — Dior'],
  ['PS243','Sac Neverfull — Louis Vuitton'],
  ['FGSCNVIOZ2X1TEHD73GU','Cabas à motifs — Chanel'],
]
const snap = await db.collection('produits').select('sku','imageUrls').limit(6000).get()
const bySku={}
for(const doc of snap.docs){ const p=doc.data(); const sk=S(p.sku).toUpperCase(); if(Array.isArray(p.imageUrls)&&p.imageUrls[0]) bySku[sk]=p.imageUrls[0] }
const imgs = WANT.map(([sku,alt])=>({ sku, alt, url: bySku[sku] })).filter(x=>x.url)
console.log('images trouvées:', imgs.map(i=>i.sku).join(', '))
if(imgs.length<5) console.log('⚠️ manquants:', WANT.map(w=>w[0]).filter(s=>!bySku[s]).join(', '))

// points d'insertion FR (avant ces titres) et EN
const FR = ['## 3. Les coutures','## 5. La quincaillerie','## 7. Le numéro de série','## Le cas particulier du vintage','## Faut-il faire authentifier']
const EN = ['## 3. Stitching and finishing','## 5. The hardware','## 7. Serial number','## The special case of vintage','## Should you have your bag authenticated']

const ref = db.collection('siteConfig').doc('_journal')
const s2 = await ref.get(); const articles=s2.data().articles
for(const a of articles){
  if(a.slug!=='reconnaitre-vrai-sac-luxe-vintage') continue
  const inject=(body,heads)=>{
    if(!body) return body
    imgs.forEach((im,i)=>{
      const line=`![${im.alt}](${im.url})`
      if(body.includes(im.url)) return
      const h=heads[i]; if(!h) return
      const idx=body.indexOf(h)
      if(idx>-1) body = body.slice(0,idx)+line+'\n\n'+body.slice(idx)
    })
    return body
  }
  a.body=inject(a.body,FR)
  a.bodyEn=inject(a.bodyEn,EN)
  console.log('✓ images insérées (FR + EN)')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
