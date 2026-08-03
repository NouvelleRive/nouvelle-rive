import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { config } from 'dotenv'
const sharp = (await import(new URL('../node_modules/sharp/lib/index.js', import.meta.url).pathname)).default
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
const first = d => (Array.isArray(d.imageUrls)&&d.imageUrls[0])||d.photos?.face||d.imageUrl||null
const S='/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const SKUS=['DISI137','DISI182','DISI183','DISI184','DISI185','DISI186','DISI197','DISI201','DISI204','DISI205']

const srcs=[]
for(const sku of SKUS){const s=await db.collection('produits').where('sku','==',sku).limit(1).get(); if(!s.empty){const img=first(s.docs[0].data()); if(img)srcs.push({id:sku,src:img})}}
for(let n=1;n<=9;n++) srcs.push({id:`DL${n}`, src:'file://'+join(homedir(),'Downloads',`DISI${n}.jpg`)})

// dHash 64 bits
const dhash = async (src) => {
  const path = src.startsWith('file://') ? src.slice(7) : src
  let buf
  if (src.startsWith('http')) { const r = await fetch(src); buf = Buffer.from(await r.arrayBuffer()) } else buf = path
  const {data} = await sharp(buf).grayscale().resize(9,8,{fit:'fill'}).raw().toBuffer({resolveWithObject:true})
  let bits=0n, k=0n
  for(let y=0;y<8;y++) for(let x=0;x<8;x++){ const l=data[y*9+x], r=data[y*9+x+1]; if(l>r) bits|=(1n<<k); k++ }
  return bits
}
const ham = (a,b)=>{let x=a^b,c=0; while(x){c+=Number(x&1n);x>>=1n} return c}

const hashed=[]
for(const o of srcs){ try{ o.h=await dhash(o.src); hashed.push(o) }catch(e){ console.log('skip',o.id,e.message) } }
// dedupe : garder le 1er, retirer ceux à distance <=8
const keep=[]
for(const o of hashed){ const dup=keep.find(k=>ham(k.h,o.h)<=8); if(dup) console.log('doublon:',o.id,'≈',dup.id); else keep.push(o) }
// mélange
const tiles=keep.map(o=>o.src)
for(let i=tiles.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[tiles[i],tiles[j]]=[tiles[j],tiles[i]]}
writeFileSync(S+'/ds-order.json', JSON.stringify(tiles))
console.log('gardées:',tiles.length,'/ '+srcs.length,'(doublons retirés)')
process.exit(0)
