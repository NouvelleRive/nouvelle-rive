import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const OLD="C'est un lieu unique, où plusieurs âmes cohabitent : le Marais historique est à la fois un berceau de la mode parisienne, le cœur du quartier juif — avec l'une des plus anciennes synagogues de Paris — et l'un des grands quartiers gays de la ville. C'est aussi le seul quartier de Paris à avoir conservé ses ruelles étroites et ses immeubles parfois de guingois d'avant la Révolution — épargné par la grande transformation du baron Haussmann, entamée en 1853. Le Marais garde ainsi mille secrets du Paris d'autrefois. Les rues racontent tout ça : la rue des Écouffes, où l'on est, était « la rue aux vêtements » et l'ancienne rue aux filles ; à deux pas, la rue des Mauvais Garçons. Ambiance pavés, esprit village, et une vraie densité de friperies au kilo, de dépôts-ventes et de vintage de créateur."
const NEW=`C'est un lieu unique, où les époques se superposent. Quartier juif dès le Moyen Âge, puis quartier aristocratique aux XVIe et XVIIe siècles — on en trouve encore les traces partout : des religieux se promènent rue des Rosiers, tout près de l'une des plus anciennes synagogues de Paris ; on y déguste parmi les meilleurs restaurants ashkénazes et séfarades de la ville ; et des hôtels particuliers se cachent derrière les porches. Le Marais regorge de trésors cachés — c'est sûrement pour ça que créatrices, créateurs et artisans en ont fait leur quartier de prédilection aujourd'hui.

C'est aussi un berceau de la mode et l'un des grands quartiers gays de la ville — et le seul quartier de Paris à avoir conservé ses ruelles étroites et ses immeubles parfois de guingois d'avant la Révolution, épargné par la grande transformation du baron Haussmann entamée en 1853. Les rues racontent tout ça : la rue des Écouffes, où l'on est, était « la rue aux vêtements » et l'ancienne rue aux filles ; à deux pas, la rue des Mauvais Garçons. Ambiance pavés, esprit village, et une vraie densité de friperies au kilo, de dépôts-ventes et de vintage de créateur.`
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  if(a.body.includes(OLD)){ a.body=a.body.replace(OLD,NEW); console.log('✓ histoire du Marais enrichie (Moyen Âge → nobles → aujourd\\'hui)') }
  else console.log('✗ ancre non trouvée (le texte a peut-être changé)')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
