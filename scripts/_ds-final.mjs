import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
const first = d => (Array.isArray(d.imageUrls)&&d.imageUrls[0])||d.photos?.face||d.imageUrl||null
const S='/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const SKUS=['DISI137','DISI182','DISI183','DISI184','DISI185','DISI186','DISI197','DISI201','DISI204','DISI205']
let tiles=[]
for(const sku of SKUS){const s=await db.collection('produits').where('sku','==',sku).limit(1).get()
  if(s.empty){console.log(sku,'❌');continue}; const img=first(s.docs[0].data()); if(img){tiles.push(img);console.log(sku,'✓')}else console.log(sku,'pas image')}
const DESK=join(homedir(),'Desktop','..','Downloads')
for(let n=1;n<=5;n++) tiles.push('file://'+join(homedir(),'Downloads',`DISI${n}.jpg`))
// mélange
for(let i=tiles.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[tiles[i],tiles[j]]=[tiles[j],tiles[i]]}
writeFileSync(S+'/ds-order.json', JSON.stringify(tiles))
console.log('total:',tiles.length,'tuiles (mélangées)')
process.exit(0)
