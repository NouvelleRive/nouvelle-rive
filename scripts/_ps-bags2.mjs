import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
const catLabel = d => typeof d.categorie==='object'?d.categorie?.label:d.categorie
const all = await db.collection('produits').orderBy('sku').startAt('PS').endAt('PS￿').get()
let sac=0,sacInvendu=0,vendus=0
all.forEach(doc=>{const d=doc.data();if(!/^PS\d/.test(d.sku||''))return; if(catLabel(d)==='PS - Sac'){sac++; if(!d.vendu)sacInvendu++; else vendus++}})
console.log('PS - Sac total:',sac,'| invendus:',sacInvendu,'| vendus:',vendus)
process.exit(0)
