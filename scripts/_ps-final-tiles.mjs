import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { writeFileSync } from 'fs'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
const pick = d => (d.photos?.face)||(Array.isArray(d.imageUrls)&&d.imageUrls[0])||d.imageUrl||null
const catLabel = d => typeof d.categorie==='object'?d.categorie?.label:d.categorie
const all = await db.collection('produits').orderBy('sku').startAt('PS').endAt('PS￿').get()
const bags=[]
all.forEach(doc=>{const d=doc.data();if(!/^PS\d/.test(d.sku||''))return; if(catLabel(d)==='PS - Sac'&&!d.vendu){const img=pick(d);if(img)bags.push(img)}})
const WANT=['PS175','PS221','PS223','PS234','PS5','PS108']; const clothes=[]
for(const sku of WANT){const s=await db.collection('produits').where('sku','==',sku).limit(1).get();if(!s.empty){const img=pick(s.docs[0].data());if(img)clothes.push(img)}}
// interleave : insérer les 6 vêtements régulièrement parmi les sacs
const step=Math.floor(bags.length/(clothes.length+1))||1
const out=[...bags]; clothes.forEach((c,i)=>out.splice((i+1)*step+i,0,c))
writeFileSync('/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad/ps-order.json', JSON.stringify(out))
console.log('sacs:',bags.length,'| vêtements:',clothes.length,'| total tuiles:',out.length)
process.exit(0)
