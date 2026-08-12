import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
import zlib from 'zlib'; import sharp from 'sharp'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const [buf] = await getStorage().bucket().file('_cache/produits-all.json.gz').download()
let txt; try { txt = zlib.gunzipSync(buf).toString() } catch { txt = buf.toString('utf8') }
const list = JSON.parse(txt)
const pp = list.filter(it => (it.raw||it).sku?.startsWith('PP'))
let nonsq=[], noimg=[], tot=0
async function dim(u){ const r=await fetch(u); const ab=Buffer.from(await r.arrayBuffer()); const m=await sharp(ab).metadata(); return m }
const q=[...pp]; const CONC=12
async function worker(){ while(q.length){ const it=q.shift(); const p=it.raw||it
  const u=p.imageUrl||p.photos?.face; if(!u){ noimg.push(p.sku); continue }
  try{ const m=await dim(u); tot++; if(m.width!==m.height) nonsq.push(`${p.sku} ${m.width}x${m.height} ${u.split('/').pop()}`) }catch(e){}
}}
await Promise.all(Array.from({length:CONC},()=>worker()))
console.log('PP scannées:', tot, '| sans image:', noimg.length)
console.log('NON CARRÉES:', nonsq.length)
nonsq.slice(0,60).forEach(x=>console.log(' ', x))
