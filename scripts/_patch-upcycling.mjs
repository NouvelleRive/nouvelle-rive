import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get(); const articles=snap.data().articles
const OLD = "Deux formes coexistent : l'upcycling artisanal (pièces uniques, faites main) et l'upcycling à partir de deadstock (chutes ou stocks d'usine invendus)."
const NEW = "On distingue deux grands types. L'upcycling post-production part de matières neuves jamais utilisées — notamment le deadstock (chutes et stocks d'usine invendus) : il permet parfois de générer de toutes petites séries. L'upcycling post-consommation, lui, repart d'une pièce qui a déjà été portée : il donne le plus souvent une pièce unique, ou quasi unique."
let ok=false
for(const a of articles) if(a.slug==='vintage-upcycle-regenere-difference'){
  if(a.body.includes(OLD)){ a.body=a.body.split(OLD).join(NEW); ok=true; console.log('✓ upcycling détaillé (post-prod vs post-conso)') }
  else console.log('✗ phrase originale non trouvée (déjà modifiée ?)')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(ok?0:0)
