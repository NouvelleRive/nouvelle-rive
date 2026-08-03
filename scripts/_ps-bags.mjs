import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { writeFileSync } from 'fs'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') }) })
const db = getFirestore()
const pick = d => (d.photos?.face) || (Array.isArray(d.imageUrls) && d.imageUrls[0]) || d.imageUrl || null
const catLabel = d => typeof d.categorie === 'object' ? d.categorie?.label : d.categorie
const all = await db.collection('produits').orderBy('sku').startAt('PS').endAt('PS').get()
const bags = []
all.forEach(doc => { const d = doc.data(); if(!/^PS\d/.test(d.sku||''))return
  if (catLabel(d) === 'PS - Sac' && !d.vendu) { const img=pick(d); if(img) bags.push({sku:d.sku, marque:d.marque, img}) }
})
// 6 vêtements demandés
const WANT = ['PS175','PS221','PS223','PS234','PS5','PS108']
const clothes = []
for (const sku of WANT) { const s=await db.collection('produits').where('sku','==',sku).limit(1).get()
  if(s.empty){console.log(sku,'❌');continue}; const d=s.docs[0].data(); const img=pick(d)
  console.log(sku, catLabel(d), '| vendu:',d.vendu, img?'✓':'❌'); if(img) clothes.push({sku, marque:d.marque, img}) }
console.log('\nSacs invendus:', bags.length, '| Vêtements:', clothes.length)
writeFileSync('/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad/ps-bags.json', JSON.stringify({bags, clothes}, null, 0))
process.exit(0)
