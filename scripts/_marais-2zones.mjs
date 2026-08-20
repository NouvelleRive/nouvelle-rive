import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const FR_OLD="Chaque coin a son ambiance : d'un côté le Marais historique, populaire et pavé ; de l'autre le Haut Marais, ses concept stores et ses galeries."
const FR_NEW="Le Marais se scinde en deux zones principales : le Marais historique, populaire et pavé, et le Haut Marais, plus tranquille et décontracté. Chacune a son ambiance."
const EN_OLD="Each corner has its own vibe: on one side the historic Marais, lively and cobbled; on the other the Haut Marais, with its concept stores and galleries."
const EN_NEW="The Marais splits into two main areas: the historic Marais, lively and cobbled, and the Haut Marais, more laid-back and relaxed. Each has its own vibe."
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  if(a.body?.includes(FR_OLD)){ a.body=a.body.replace(FR_OLD,FR_NEW); console.log('FR ok') } else console.log('FR absent')
  if(a.bodyEn?.includes(EN_OLD)){ a.bodyEn=a.bodyEn.replace(EN_OLD,EN_NEW); console.log('EN ok') } else console.log('EN absent')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
