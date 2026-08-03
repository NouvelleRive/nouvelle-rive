import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { writeFileSync } from 'fs'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
// NOUVELLE règle : 1re photo de l'annonce
const first = d => (Array.isArray(d.imageUrls) && d.imageUrls[0]) || d.photos?.face || d.imageUrl || null
const catLabel = d => typeof d.categorie==='object'?d.categorie?.label:d.categorie
const getBySku = async sku => { const s=await db.collection('produits').where('sku','==',sku).limit(1).get(); return s.empty?null:s.docs[0].data() }

console.log('=== VERIF : imageUrls[0] vs photos.face ===')
for (const sku of ['PS221','PS108','AGE153','AGE55']) {
  const d = await getBySku(sku); if(!d){console.log(sku,'❌');continue}
  const n=(d.imageUrls||[]).length
  console.log(sku, '| imageUrls:', n, '| [0]=', (d.imageUrls?.[0]||'').split('/').pop(), '| face=', (d.photos?.face||'').split('/').pop())
}

// AGE : 11 SKU firestore -> imageUrls[0]
const ageSkus=['AGE213','AGE211','AGE148','AGE153','AGE154','AGE190','AGE193','AGE199','AGE135','AGE55','AGE77']
const ageImgs=[]
for(const sku of ageSkus){const d=await getBySku(sku); ageImgs.push(d?first(d):null)}
writeFileSync('/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad/age-imgs.json', JSON.stringify(ageImgs))
console.log('\nAGE: '+ageImgs.filter(Boolean).length+'/11 (1re photo)')

// PS : sacs non vendus + non rendus (statut != retour) + 6 vêtements, 1re photo
const all = await db.collection('produits').orderBy('sku').startAt('PS').endAt('PS￿').get()
const bags=[]
all.forEach(doc=>{const d=doc.data();if(!/^PS\d/.test(d.sku||''))return
  if(catLabel(d)==='PS - Sac' && !d.vendu && d.statut!=='retour'){const img=first(d); if(img)bags.push(img)}})
const WANT=['PS175','PS221','PS223','PS234','PS5','PS108']; const clothes=[]
for(const sku of WANT){const d=await getBySku(sku); if(d){const img=first(d);if(img)clothes.push(img)}}
const step=Math.floor(bags.length/(clothes.length+1))||1
const out=[...bags]; clothes.forEach((c,i)=>out.splice((i+1)*step+i,0,c))
writeFileSync('/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad/ps-order.json', JSON.stringify(out))
console.log('PS: sacs(hors rendus)='+bags.length+' + vêtements='+clothes.length+' = '+out.length+' tuiles')
process.exit(0)
