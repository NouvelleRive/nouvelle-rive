import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const g=(q)=>`https://www.google.com/maps/search/${encodeURIComponent(q)}`
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  // Chez Anna dans les déjeuners (ancre sur la fin du lien Alaïa)
  if(!a.body.includes('Chez Anna')){
    const anchor="Alaia%20Paris)."
    if(a.body.includes(anchor)){ a.body=a.body.replace(anchor, `Alaia%20Paris), ou une bonne table [Chez Anna](${g('Chez Anna restaurant Marais Paris')}).`); console.log('OK Chez Anna') }
    else console.log('ancre Alaia absente')
  } else console.log('Chez Anna deja present')
  // Hôtel de Ville dans "À ne pas manquer"
  if(!a.body.includes('Hôtel de Ville')){
    const anchor="(collections permanentes gratuites)."
    if(a.body.includes(anchor)){ a.body=a.body.replace(anchor, `(collections permanentes gratuites).\n- L'[Hôtel de Ville](${g('Hotel de Ville Paris')}) : la façade monumentale et son parvis, aux portes du Marais.`); console.log('OK Hotel de Ville') }
    else console.log('ancre Carnavalet absente')
  } else console.log('HdV deja present')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
