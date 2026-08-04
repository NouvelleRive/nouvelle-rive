import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('/Users/salomekassabi/Desktop/nouvelle-rive/.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
const snap = await db.collection('produits').get()
const ms = v => !v?0 : (v._seconds? v._seconds*1000 : (v.seconds? v.seconds*1000 : (v.toMillis?v.toMillis():0)))
let found=[]
snap.forEach(d=>{
  const r=d.data()
  const blob=((r.nom||'')+' '+(r.marque||'')+' '+(r.sku||'')).toLowerCase()
  if(blob.includes('pristin')) found.push({id:d.id, nom:r.nom, marque:r.marque, sku:r.sku,
    createdAt:ms(r.createdAt), dateReception:ms(r.dateReception),
    vendu:r.vendu, hidden:r.hidden, recu:r.recu, statut:r.statut, statutRecuperation:r.statutRecuperation,
    quantite:r.quantite, prix:r.prix, forceDisplay:r.forceDisplay,
    hasPhoto: !!(r.photos?.face||r.imageUrls?.[0]||r.imageUrl)})
})
console.log('total produits:', snap.size)
console.log('pristin matches:', found.length)
found.slice(0,15).forEach(f=>console.log(JSON.stringify(f)))
process.exit(0)
