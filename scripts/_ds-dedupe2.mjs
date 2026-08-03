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
const dhash = async (src) => {
  let buf = src.startsWith('http') ? Buffer.from(await (await fetch(src)).arrayBuffer()) : (src.startsWith('file://')?src.slice(7):src)
  const {data} = await sharp(buf).grayscale().resize(9,8,{fit:'fill'}).raw().toBuffer({resolveWithObject:true})
  let bits=0n,k=0n; for(let y=0;y<8;y++)for(let x=0;x<8;x++){if(data[y*9+x]>data[y*9+x+1])bits|=(1n<<k);k++} return bits }
const ham=(a,b)=>{let x=a^b,c=0;while(x){c+=Number(x&1n);x>>=1n}return c}

// 10 SKU : toujours gardés
const kept=[]
for(const sku of SKUS){const s=await db.collection('produits').where('sku','==',sku).limit(1).get(); if(!s.empty){const img=first(s.docs[0].data()); if(img){kept.push({id:sku,src:img,h:await dhash(img)})}}}
// Downloads : ajout si pas quasi-identique à une tuile déjà gardée (seuil strict =5)
for(let n=1;n<=9;n++){ const src='file://'+join(homedir(),'Downloads',`DISI${n}.jpg`)
  try{ const h=await dhash(src); const dmin=Math.min(...kept.map(k=>ham(k.h,h))); const near=kept[kept.map(k=>ham(k.h,h)).indexOf(dmin)]
    if(dmin<=5){ console.log(`DISI${n} doublon (dist ${dmin} ≈ ${near.id}) -> retiré`) } else { kept.push({id:`DL${n}`,src,h}); console.log(`DISI${n} gardé (dist min ${dmin})`) }
  }catch(e){console.log(`DISI${n} err`,e.message)} }
const tiles=kept.map(o=>o.src)
for(let i=tiles.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[tiles[i],tiles[j]]=[tiles[j],tiles[i]]}
writeFileSync(S+'/ds-order.json', JSON.stringify(tiles))
console.log('total gardées:',tiles.length)
process.exit(0)
