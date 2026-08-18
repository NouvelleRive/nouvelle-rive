import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get()
const articles = snap.data().articles
const OLD = "Un métal léger, une gravure floue, une couleur qui s'écaille trahissent une contrefaçon."
const NEW = "Un métal trop léger, une gravure floue ou approximative doivent alerter. En revanche, sur une pièce vintage, la quincaillerie se patine et se ternit naturellement avec le temps : c'est normal, pas un signe de contrefaçon. Méfiez-vous surtout d'une dorure qui s'écaille alors que la pièce est présentée comme peu portée."
for (const a of articles){
  if(a.slug==='reconnaitre-vrai-sac-luxe-vintage'){
    if(a.body.includes(OLD)){ a.body=a.body.split(OLD).join(NEW); console.log('✓ quincaillerie nuancée') } else console.log('✗ phrase non trouvée')
    a.cover='https://nouvellerive.b-cdn.net/produits/conserved_1784413760400_xikk9b.png'
    console.log('✓ cover = sac Chanel')
  }
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
console.log('done')
process.exit(0)
