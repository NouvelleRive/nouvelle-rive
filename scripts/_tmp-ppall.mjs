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
console.log('PP total docs:', pp.length)
// look at structure of one
const ex = pp.find(it=>(it.raw||it).sku==='PP52') || pp[0]
const p = ex.raw||ex
console.log('\n=== champs image de', p.sku, '===')
for(const k of ['imageUrl','imageUrls','photos','photosPortees','mannequinUrls']){ 
  const v=p[k]; if(v!==undefined) console.log(k, '=', JSON.stringify(v).slice(0,300)) }
// check dims of every image of 8 PP
let nonsq=0, tot=0
for(const it of pp.filter((_,i)=>i%Math.ceil(pp.length/8)===0).slice(0,8)){
  const q=it.raw||it; const urls=new Set()
  if(q.imageUrl) urls.add(q.imageUrl)
  if(Array.isArray(q.imageUrls)) q.imageUrls.forEach(u=>urls.add(u))
  if(q.photos) Object.values(q.photos).forEach(u=>{if(typeof u==='string')urls.add(u)})
  console.log(`\n${q.sku}:`)
  for(const u of urls){ try{ const r=await fetch(u); const ab=Buffer.from(await r.arrayBuffer()); const m=await sharp(ab).metadata(); tot++; const sq=m.width===m.height; if(!sq)nonsq++; console.log(`  ${m.width}x${m.height} ${sq?'':'<<NON CARRE'} ${u.split('/').pop()}`)}catch(e){console.log('  ERR',u.split('/').pop())} }
}
console.log(`\nNON CARRE: ${nonsq}/${tot}`)
