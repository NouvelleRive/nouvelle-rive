import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync } from 'fs'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
const first = d => (Array.isArray(d.imageUrls)&&d.imageUrls[0])||d.photos?.face||d.imageUrl||null
const S='/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
let a=JSON.parse(readFileSync(S+'/age-ordered.json','utf8'))
for (const sku of ['AGE236','AGE235','AGE234']) {
  const s=await db.collection('produits').where('sku','==',sku).limit(1).get()
  if(s.empty){console.log(sku,'❌ INTROUVABLE');continue}
  const img=first(s.docs[0].data()); if(img&&!a.includes(img)){a.push(img);console.log(sku,'✓ ajouté')}
}
// re-mélange
for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
writeFileSync(S+'/age-ordered.json',JSON.stringify(a))
console.log('total mélangé:',a.length,'tuiles')
process.exit(0)
