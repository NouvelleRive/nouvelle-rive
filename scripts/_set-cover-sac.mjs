import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const SKU=process.argv[2], SLUG=process.argv[3]
const db = getFirestore()
const S=(v)=>Array.isArray(v)?v.join(' '):String(v??'')
const snap = await db.collection('produits').select('sku','nom','imageUrls').limit(5000).get()
let url=null
for (const doc of snap.docs){ const p=doc.data(); if(S(p.sku).toUpperCase()===SKU){ url=Array.isArray(p.imageUrls)?p.imageUrls[0]:null; console.log('MATCH',SKU,S(p.nom).slice(0,40)); break } }
if(!url){ console.log('❌ introuvable',SKU); process.exit(1) }
const ref = db.collection('siteConfig').doc('_journal')
const s2 = await ref.get(); const articles=s2.data().articles
for(const a of articles) if(a.slug===SLUG){ a.cover=url; console.log('✓ cover',SLUG,'=',url) }
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
