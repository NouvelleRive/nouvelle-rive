import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
const S = (v)=>Array.isArray(v)?v.join(' '):String(v??'')
const LUX = ['chanel','dior','vuitton','hermes','hermès','gucci','prada','celine','céline','fendi','saint laurent','ysl','balenciaga','loewe','bottega','chloe','chloé']
const snap = await db.collection('produits').select('marque','categorie','nom','imageUrls').limit(4000).get()
let n=0
for (const doc of snap.docs){
  const p=doc.data()
  const m=S(p.marque).toLowerCase()
  const cat=S(p.categorie).toLowerCase()
  if(!LUX.some(l=>m.includes(l))) continue
  if(!/sac|bag|maroquin/.test(cat)) continue
  const url=Array.isArray(p.imageUrls)?p.imageUrls[0]:null
  if(!url) continue
  console.log(`${S(p.marque)} | ${url}`)
  if(++n>=12) break
}
console.log('TOTAL:',n)
process.exit(0)
