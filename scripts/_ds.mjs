import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { writeFileSync } from 'fs'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
const first = d => (Array.isArray(d.imageUrls)&&d.imageUrls[0])||d.photos?.face||d.imageUrl||null
const s = await db.collection('produits').orderBy('sku').startAt('DS').endAt('DS￿').get()
const items=[]
s.forEach(doc=>{const d=doc.data(); if(!/^DS\d/.test(d.sku||''))return
  items.push({sku:d.sku, marque:d.marque, modele:d.modele, vendu:!!d.vendu, statut:d.statut||'', img:first(d)})})
console.log('DS total:',items.length)
console.log('marques:',[...new Set(items.map(i=>i.marque))].join(' | '))
const dispo=items.filter(i=>!i.vendu && i.statut!=='retour' && i.img)
console.log('dispo avec photo:',dispo.length)
console.log('modèles:', JSON.stringify(dispo.reduce((a,i)=>{a[i.modele||'?']=(a[i.modele||'?']||0)+1;return a},{})))
writeFileSync('/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad/ds-items.json', JSON.stringify(dispo))
process.exit(0)
