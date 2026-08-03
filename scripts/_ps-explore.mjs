import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') }) })
const db = getFirestore()
const s = await db.collection('produits').where('sku','==','PS175').limit(1).get()
if(!s.empty){const d=s.docs[0].data();console.log('CHAMPS PS175:',Object.keys(d).join(', '));console.log('categorie:',d.categorie,'| type:',d.type,'| matiere:',d.matiere,'| vendu:',d.vendu,'| statut:',d.statut,'| marque:',d.marque)}
const all = await db.collection('produits').orderBy('sku').startAt('PS').endAt('PS').get()
const cats={}; let n=0
all.forEach(doc=>{const d=doc.data(); if(!/^PS\d/.test(d.sku||''))return; n++; const c=(d.categorie||d.type||'?'); cats[c]=(cats[c]||0)+1})
console.log('\nTotal PS:',n)
console.log('Catégories:',JSON.stringify(cats,null,1))
process.exit(0)
