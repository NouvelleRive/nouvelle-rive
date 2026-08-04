import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
import zlib from 'zlib'
import fs from 'fs'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const [buf] = await getStorage().bucket().file('_cache/produits-all.json.gz').download()
let txt; try { txt = zlib.gunzipSync(buf).toString() } catch { txt = buf.toString('utf8') }
const list = JSON.parse(txt)
const want = ['DICL86','PRI140','MB121','AIM206','MAZ125','SOI191','NAN135','EQU99']
const dir = process.argv[2]
for (const it of list){ const p=it.raw||it; if(want.includes(p.sku)){
  const url=p.imageUrl||p.photos?.face; const r=await fetch(url); const ab=Buffer.from(await r.arrayBuffer())
  fs.writeFileSync(`${dir}/ex_${p.sku}.png`, ab); console.log('saved', p.sku, url)
}}
