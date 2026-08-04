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
const dir = process.argv[2]
const pp = list.filter(it => (it.raw||it).sku?.startsWith('PP')).filter(it => (it.raw||it).imageUrl || (it.raw||it).photos?.face)
console.log('PP total avec photo:', pp.length)
// margin analyzer
async function marges(ab){
  const { data, info } = await sharp(ab).removeAlpha().raw().toBuffer({ resolveWithObject:true })
  const { width:W, height:H, channels:C } = info
  const blancCol = x => { for(let y=0;y<H;y++){const i=(y*W+x)*C; if(data[i]<249||data[i+1]<249||data[i+2]<249) return false} return true }
  let l=0; while(l<W&&blancCol(l))l++
  let r=0; while(r<W&&blancCol(W-1-r))r++
  // couleur du 1er pixel non blanc au milieu vertical, colonne l
  const y=Math.floor(H/2); const i=(y*W+l)*C
  return {l,r,W,H, px:[data[i],data[i+1],data[i+2]]}
}
let withband=0, samples=[]
for (const it of pp){ const p=it.raw||it; const url=p.imageUrl||p.photos?.face
  try{ const r=await fetch(url); const ab=Buffer.from(await r.arrayBuffer()); const m=await marges(ab)
    const pct=Math.round((m.l+m.r)/m.W*100)
    if(m.l+m.r>m.W*0.03){ withband++; if(samples.length<8){ fs.writeFileSync(`${dir}/pp_${p.sku}.png`,ab); samples.push(p.sku) } }
  }catch(e){}
}
console.log('PP avec bande blanche laterale:', withband, '/', pp.length)
console.log('echantillons sauves:', samples.join(' '))
