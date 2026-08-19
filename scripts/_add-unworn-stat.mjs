import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
const NEW_BULLET="- En France, plus de la moitié des vêtements ne sont jamais portés — dont environ 120 millions de pièces encore neuves qui dorment dans les placards (ADEME, 2025)."
for(const a of articles) if(a.slug==='vintage-plutot-que-fast-fashion'){
  if(!a.body.includes('jamais portés')){
    // insérer après le dernier repère (bullet "jette en moyenne")
    const anchor=a.body.match(/- .*jette en moyenne[^\n]*\n/)
    if(anchor){ a.body=a.body.replace(anchor[0], anchor[0]+NEW_BULLET+'\n'); console.log('✓ stat pièces jamais portées ajoutée') }
    else console.log('✗ ancre bullet non trouvée')
  } else console.log('· déjà présent')
  // ajouter la source ADEME 2025 si absente
  a.sources=a.sources||[]
  if(!a.sources.some(s=>s.url.includes('dossier-de-presse-ademe-textile')))
    a.sources.unshift({label:'ADEME — Étude sur les textiles (2025)', url:'https://www.ademe.fr/wp-content/uploads/2025/07/dossier-de-presse-ademe-textile-250625-def.pdf'})
  console.log('✓ sources:',a.sources.length)
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
