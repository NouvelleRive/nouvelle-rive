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
async function analyse(ab){
  const { data, info } = await sharp(ab).removeAlpha().raw().toBuffer({ resolveWithObject:true })
  const { width:W, height:H, channels:C } = info
  const blancCol = x => { for(let y=0;y<H;y++){const i=(y*W+x)*C; if(data[i]<249||data[i+1]<249||data[i+2]<249) return false} return true }
  let l=0; while(l<W&&blancCol(l))l++
  let r=0; while(r<W&&blancCol(W-1-r))r++
  const y=Math.floor(H/2); const gi=(y*W+Math.min(l+2,W-1))*C
  return {l,r,W,H, interieur:[data[gi],data[gi+1],data[gi+2]]}
}
const res=[]
for (const it of pp){ const p=it.raw||it; const url=p.imageUrl||p.photos?.face
  try{ const r=await fetch(url); const ab=Buffer.from(await r.arrayBuffer()); const m=await analyse(ab)
    const band=m.l+m.r; const intBlanc = m.interieur.every(v=>v>=245)
    res.push({sku:p.sku, band, l:m.l, r:m.r, int:m.interieur, intBlanc, ab, url}) }catch(e){}
}
// vrai defaut = bande importante ET interieur non blanc (beton/gris) => rectangle visible
const bad = res.filter(x=>x.band>x.l+x.r> 0).filter(x=> (x.l+x.r) > 40 && !x.intBlanc).sort((a,b)=>b.band-a.band)
console.log('PP avec bande + interieur NON blanc:', bad.length,'/',pp.length)
console.log('--- top 15 ---')
for(const x of bad.slice(0,15)) console.log(`${x.sku.padEnd(8)} L${x.l} R${x.r} int=[${x.int}]`)
bad.slice(0,6).forEach(x=>fs.writeFileSync(`${dir}/bad_${x.sku}.png`, x.ab))
console.log('saved:', bad.slice(0,6).map(x=>x.sku).join(' '))
// aussi combien interieur blanc (fond blanc, OK)
console.log('PP bande mais interieur BLANC (fond blanc, ok):', res.filter(x=>(x.l+x.r)>40 && x.intBlanc).length)
