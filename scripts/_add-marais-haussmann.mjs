import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const OLD="et l'un des grands quartiers gays de la ville."
const NEW="et l'un des grands quartiers gays de la ville. C'est aussi le seul quartier de Paris à avoir conservé ses ruelles étroites et ses immeubles parfois de guingois d'avant la Révolution — épargné par les grands travaux du baron Haussmann."
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  if(a.body.includes('Haussmann')){ console.log('· déjà présent') }
  else if(a.body.includes(OLD)){ a.body=a.body.replace(OLD,NEW); console.log('✓ détail Haussmann/rues étroites ajouté') }
  else console.log('✗ ancre non trouvée')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
