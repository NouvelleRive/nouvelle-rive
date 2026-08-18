import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get(); const articles=snap.data().articles
const IMPACT = `## En termes d'impact écologique

Bonne nouvelle : tout cela vaut mieux que le neuf. Mais il existe une hiérarchie. La seconde main portée telle quelle — le vintage, la friperie — reste la plus écologique de toutes : aucune transformation, seulement du transport. Vient ensuite l'upcycling, qui repart de la pièce existante avec très peu d'énergie. Puis le régénéré : plus vertueux que le neuf, mais plus gourmand en énergie, puisqu'il faut broyer ou refondre la matière. Bonus de l'upcyclé : il est aussi plus exclusif, puisqu'il donne des pièces uniques ou quasi uniques.

`
const ANCHOR='## Le point commun de tous ces mots'
for(const a of articles) if(a.slug==='vintage-upcycle-regenere-difference'){
  if(a.body.includes("En termes d'impact écologique")){ console.log('· déjà présent'); break }
  const i=a.body.indexOf(ANCHOR)
  if(i>-1){ a.body=a.body.slice(0,i)+IMPACT+a.body.slice(i); console.log('✓ section impact insérée (texte utilisatrice préservé)') }
  else console.log('✗ ancre non trouvée')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
