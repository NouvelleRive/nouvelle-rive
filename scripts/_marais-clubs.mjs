import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const OLD="de style et de fête. C'est aussi le seul quartier de Paris"
const NEW="de style et de fête. Le Marais historique regorge de petits clubs et de bars, et l'on s'y sent vraiment libre d'être soi-même, comme à la maison : religieux, filles et gays, fashionistas, amateurs et amatrices d'art, fêtards et fêtardes — tout ce petit monde cohabite et s'enrichit. C'est aussi le seul quartier de Paris"
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  if(a.body.includes('petits clubs')){ console.log('deja present') }
  else if(a.body.includes(OLD)){ a.body=a.body.replace(OLD,NEW); console.log('OK clubs/bars + cohabitation ajoutes') }
  else console.log('ancre absente')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
