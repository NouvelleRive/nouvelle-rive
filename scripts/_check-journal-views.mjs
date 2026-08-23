import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db=getFirestore()
const snap=await db.collection('backstage_jours').get()
let totalPV=0, journalViews={}, anyPages=0
for(const doc of snap.docs){
  const d=doc.data()
  totalPV += d.pageviews||0
  const pages=d.pages||{}
  for(const k of Object.keys(pages)){
    anyPages++
    if(k.includes('journal')){ journalViews[k]=(journalViews[k]||0)+(pages[k]?.v||0) }
  }
}
console.log('jours enregistrés:', snap.size)
console.log('pageviews TOTAL (tout le site):', totalPV)
console.log('clés de page distinctes:', anyPages)
console.log('vues /journal:', Object.keys(journalViews).length ? journalViews : 'AUCUNE')
process.exit(0)
