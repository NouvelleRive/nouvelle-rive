import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
import zlib from 'zlib'; import fs from 'fs'; import sharp from 'sharp'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const [buf] = await getStorage().bucket().file('_cache/produits-all.json.gz').download()
let txt; try { txt = zlib.gunzipSync(buf).toString() } catch { txt = buf.toString('utf8') }
const list = JSON.parse(txt)
const dir=process.argv[2]
const bri = list.filter(it=>(it.raw||it).chineurUid==='IOgvduRNywbXe0TA2Xtc9kKnaAD2')
console.log('BRI (chineur brillante):', bri.length)
async function marges(ab){
  const { data, info } = await sharp(ab).removeAlpha().raw().toBuffer({ resolveWithObject:true })
  const { width:W, height:H, channels:C } = info
  const blancCol = x => { for(let y=0;y<H;y++){const i=(y*W+x)*C; if(data[i]<249||data[i+1]<249||data[i+2]<249) return false} return true }
  let l=0; while(l<W&&blancCol(l))l++
  let r=0; while(r<W&&blancCol(W-1-r))r++
  const y=Math.floor(H/2); const gi=(y*W+Math.min(l+2,W-1))*C
  return {l,r,W,H, int:[data[gi],data[gi+1],data[gi+2]]}
}
let n=0
for(const it of bri){ const p=it.raw||it; const url=p.imageUrl||p.photos?.face; if(!url){console.log(p.sku,'NO IMG');continue}
  try{ const r=await fetch(url); const ab=Buffer.from(await r.arrayBuffer()); const m=await sharp(ab).metadata(); const mg=await marges(ab)
    console.log(`${p.sku.padEnd(7)} ${m.width}x${m.height} L${mg.l} R${mg.r} int=[${mg.int}] ${url.split('/').pop()}`)
    if(n<6){fs.writeFileSync(`${dir}/bri_${p.sku}.png`,ab); n++}
  }catch(e){console.log(p.sku,'ERR',e.message)} }
