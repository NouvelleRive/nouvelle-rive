import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const A_OLD="Ambiance : ruelles pavées, esprit village, mélange de friperies au kilo à petits prix, de dépôts-ventes et de vintage trié. C'est le Marais populaire et vivant, celui où l'on fouille et où l'on trouve. On y vient pour le basique parfait comme pour la pièce des années 90 à quelques euros."
const A_NEW="C'est un lieu unique, où plusieurs âmes cohabitent : le Marais historique est à la fois un berceau de la mode parisienne, le cœur du quartier juif — avec l'une des plus anciennes synagogues de Paris — et l'un des grands quartiers gays de la ville. Les rues racontent tout ça : la rue des Écouffes, où l'on est, était « la rue aux vêtements » et l'ancienne rue aux filles ; à deux pas, la rue des Mauvais Garçons. Ambiance pavés, esprit village, et une vraie densité de friperies au kilo, de dépôts-ventes et de vintage de créateur."
const B_OLD="C'est ici qu'on est, au 8 rue des Écouffes : NOUVELLE RIVE, votre point de départ. Chaque portant y est tenu par une créatrice différente — de la pièce à moins de 20 € au vintage de luxe."
const B_NEW="Notre point de départ, c'est NOUVELLE RIVE, au 8 rue des Écouffes. Le lieu a une histoire : c'était la première boîte lesbienne du Marais, le 3W (Women with Women). On peut encore voir le fumoir en bas — et la caisse est posée sur l'ancienne cabine du DJ. Aujourd'hui, chaque portant y est tenu par une créatrice différente, de la pièce à moins de 20 € au vintage de luxe."
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  if(a.body.includes(A_OLD)){ a.body=a.body.replace(A_OLD,A_NEW); console.log('✓ ambiance Zone 1 enrichie') } else console.log('✗ A non trouvé')
  if(a.body.includes(B_OLD)){ a.body=a.body.replace(B_OLD,B_NEW); console.log('✓ histoire NR (3W) ajoutée') } else console.log('✗ B non trouvé')
  a.readingMinutes=6
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
