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
console.log('total produits:', list.length)
// sample 25 random-ish
const sample = list.filter((_,i)=>i%Math.ceil(list.length/25)===0).slice(0,25)
let nonCarre=0
for (const it of sample) {
  const p = it.raw || it
  const url = p.imageUrl || p.photos?.face
  if (!url) { console.log('NO URL', p.sku||it.id); continue }
  try {
    const r = await fetch(url)
    const ab = Buffer.from(await r.arrayBuffer())
    const m = await sharp(ab).metadata()
    const ratio = (m.width/m.height).toFixed(3)
    const flag = m.width===m.height ? '' : '  <<< NON CARRÉ'
    if (m.width!==m.height) nonCarre++
    console.log(`${(p.sku||it.id).padEnd(12)} ${m.width}x${m.height} r=${ratio}${flag}  ${url.split('/').pop()}`)
  } catch(e){ console.log('ERR', p.sku||it.id, e.message) }
}
console.log(`\nNON CARRÉ: ${nonCarre}/${sample.length}`)
