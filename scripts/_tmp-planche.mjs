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
// echantillon reparti
const pick = pp.filter((_,i)=>i%Math.ceil(pp.length/15)===0).slice(0,15)
const cell=300; const cols=5; const rows=Math.ceil(pick.length/cols)
const tiles=[]
for(const it of pick){ const p=it.raw||it; const url=p.imageUrl||p.photos?.face
  try{ const r=await fetch(url); const ab=Buffer.from(await r.arrayBuffer())
    // afficher tel quel dans une cellule grise pour voir le blanc
    const t=await sharp(ab).resize(cell,cell,{fit:'contain',background:'#cfcfcf'}).png().toBuffer()
    tiles.push({t, sku:p.sku}) }catch(e){}
}
const comp = tiles.map((x,i)=>({input:x.t, left:(i%cols)*cell, top:Math.floor(i/cols)*cell}))
await sharp({create:{width:cols*cell, height:rows*cell, channels:3, background:'#808080'}})
  .composite(comp).png().toFile(`${dir}/planche_PP.png`)
console.log('planche:', tiles.map(x=>x.sku).join(' '))
