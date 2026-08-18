import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
import zlib from 'zlib'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const [buf] = await getStorage().bucket().file('_cache/produits-all.json.gz').download()
let txt; try { txt = zlib.gunzipSync(buf).toString() } catch { txt = buf.toString('utf8') }
const list = JSON.parse(txt)
const rx=/brillante/i
const hits = list.filter(it=>{ const p=it.raw||it; return rx.test(JSON.stringify([p.marque,p.chineur,p.chineurUid,p.chineurNom,p.nom,p.sku])) })
console.log('produits ~brillante:', hits.length)
const champs={}
for(const it of hits.slice(0,3)){ const p=it.raw||it
  console.log('\n---', p.sku, '| id', it.id)
  for(const k of ['sku','nom','marque','chineur','chineurUid','chineurNom','categorie','type']) console.log('  ',k,'=',JSON.stringify(p[k]))
}
// distribution des prefixes SKU
const pref={}
for(const it of hits){ const s=(it.raw||it).sku||''; const m=s.match(/^[A-Z]+/); if(m) pref[m[0]]=(pref[m[0]]||0)+1 }
console.log('\nprefixes SKU:', JSON.stringify(pref))
