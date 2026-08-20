import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const g=(q)=>`https://www.google.com/maps/search/${encodeURIComponent(q)}`
const OLD="L'[Hôtel de Ville](https://www.google.com/maps/search/Hotel%20de%20Ville%20Paris) : la façade monumentale et son parvis, aux portes du Marais."
const NEW=`L'[Hôtel de Ville](https://www.google.com/maps/search/Hotel%20de%20Ville%20Paris) : la façade monumentale et son parvis, aux portes du Marais.\n- La [synagogue de la rue Pavée](${g("Synagogue rue Pavée Guimard Paris")}) : sa façade Art nouveau signée Hector Guimard vaut le coup d'œil — c'est un lieu de culte actif, surtout à admirer de l'extérieur (visites rares, ex. Journées du Patrimoine).`
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  if(a.body.includes('synagogue de la rue Pavée')){ console.log('deja present') }
  else if(a.body.includes(OLD)){ a.body=a.body.replace(OLD,NEW); console.log('OK synagogue ajoutee') }
  else console.log('ancre HdV absente')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
