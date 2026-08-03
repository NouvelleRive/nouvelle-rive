import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
import sharp from 'sharp'
import zlib from 'zlib'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const [buf] = await getStorage().bucket().file('_cache/produits-all.json.gz').download()
let txt; try { txt = zlib.gunzipSync(buf).toString() } catch { txt = buf.toString('utf8') }
const list = JSON.parse(txt)

// marge blanche = nb de lignes/colonnes pleines-blanches (>=249) de chaque côté
async function marges(ab){
  const img = sharp(ab).removeAlpha()
  const { data, info } = await img.raw().toBuffer({ resolveWithObject:true })
  const { width:W, height:H, channels:C } = info
  const blancCol = x => { for(let y=0;y<H;y++){const i=(y*W+x)*C; if(data[i]<249||data[i+1]<249||data[i+2]<249) return false} return true }
  const blancRow = y => { for(let x=0;x<W;x++){const i=(y*W+x)*C; if(data[i]<249||data[i+1]<249||data[i+2]<249) return false} return true }
  let l=0; while(l<W&&blancCol(l))l++
  let r=0; while(r<W&&blancCol(W-1-r))r++
  let t=0; while(t<H&&blancRow(t))t++
  let b=0; while(b<H&&blancRow(H-1-b))b++
  return {l,r,t,b,W,H}
}
const sample = list.filter((_,i)=>i%Math.ceil(list.length/40)===0).slice(0,40)
let bad=0
for (const it of sample) {
  const p = it.raw || it
  const url = p.imageUrl || p.photos?.face
  if (!url) continue
  try {
    const r = await fetch(url); const ab = Buffer.from(await r.arrayBuffer())
    const m = await marges(ab)
    const pctLR = Math.round((m.l+m.r)/m.W*100), pctTB = Math.round((m.t+m.b)/m.H*100)
    const bande = (m.l+m.r) > m.W*0.04 || (m.t+m.b) > m.H*0.04
    if (bande) bad++
    console.log(`${(p.sku||it.id).padEnd(11)} L${m.l} R${m.r} T${m.t} B${m.b}  LR=${pctLR}% TB=${pctTB}% ${bande?'<<< BANDE BLANCHE':''}`)
  } catch(e){ console.log('ERR', p.sku||it.id, e.message) }
}
console.log(`\nAVEC BANDE BLANCHE: ${bad}/${sample.length}`)
