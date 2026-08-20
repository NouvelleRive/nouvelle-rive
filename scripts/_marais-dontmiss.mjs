import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const g=(q)=>`https://www.google.com/maps/search/${encodeURIComponent(q)}`
const SECTION=`## À ne pas manquer

Au-delà des boutiques, le Marais mérite qu'on lève le nez :
- La [place des Vosges](${g('Place des Vosges Paris')}) : la plus ancienne place royale de Paris, ses arcades et son jardin — parfait pour une pause.
- La [rue des Rosiers](${g('Rue des Rosiers Paris')}) : le cœur battant du quartier juif, entre falafels, épiceries et vintage.
- Le [musée Carnavalet](${g('Musée Carnavalet Paris')}) : toute l'histoire de Paris, dans deux hôtels particuliers du Marais (collections permanentes gratuites).

`
const ANCHOR="## Les bons réflexes du tour"
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  if(a.body.includes('À ne pas manquer')){ console.log('deja present') }
  else { const i=a.body.indexOf(ANCHOR); if(i>-1){ a.body=a.body.slice(0,i)+SECTION+a.body.slice(i); console.log('OK section A ne pas manquer ajoutee') } else console.log('ancre non trouvee') }
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
