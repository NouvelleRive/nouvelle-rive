import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db = getFirestore()
const catLabel = d => typeof d.categorie==='object'?d.categorie?.label:d.categorie
const all = await db.collection('produits').orderBy('sku').startAt('PS').endAt('PS￿').get()
const keys=new Set(); const susp={}
let bagCount=0
all.forEach(doc=>{const d=doc.data();if(!/^PS\d/.test(d.sku||''))return; if(catLabel(d)!=='PS - Sac')return; bagCount++
  Object.keys(d).forEach(k=>{keys.add(k); if(/rend|retour|sorti|dispo|statut|etat|state|status|actif|archive/i.test(k)){susp[k]=susp[k]||new Set(); susp[k].add(JSON.stringify(d[k]))}})
})
console.log('bags:',bagCount)
console.log('champs "statut-like":')
for(const k of Object.keys(susp)) console.log('  ',k,'=>',[...susp[k]].slice(0,8).join(' | '))
console.log('\ntous les champs:',[...keys].sort().join(', '))
process.exit(0)
