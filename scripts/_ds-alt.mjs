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
const site=[]; for(const sku of SKUS){const s=await db.collection('produits').where('sku','==',sku).limit(1).get(); if(!s.empty){const img=first(s.docs[0].data()); if(img)site.push(img)}}
const dl=[]; for(let n=1;n<=9;n++) dl.push('file://'+join(homedir(),'Downloads',`DISI${n}.jpg`))
// alternance : DL, SITE, DL, SITE ...
const order=[]; const m=Math.max(dl.length,site.length)
for(let i=0;i<m;i++){ if(dl[i])order.push(dl[i]); if(site[i])order.push(site[i]) }
writeFileSync(S+'/ds-order.json', JSON.stringify(order))
console.log('ordre alterné (DL/site):',order.length,'tuiles | DL:',dl.length,'site:',site.length)
process.exit(0)
