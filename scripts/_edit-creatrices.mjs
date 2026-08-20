import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles

const OLD_UNIQUE = "Une jeune créatrice ne dessine pas pour plaire à tout le monde : elle dessine ce qu'elle aime, avec ses mains, ses idées, son univers. Résultat, des pièces qui ont une âme, une allure, un vrai parti pris — à des années-lumière des collections calibrées et sans surprise. Tu portes quelque chose que personne d'autre n'a. Le contraire de l'uniforme."
const NEW_UNIQUE = `Une jeune créatrice ne dessine pas pour plaire à tout le monde : elle dessine ce qu'elle aime, avec ses mains, ses idées, son univers. Résultat, des pièces qui ont une âme, une allure, un vrai parti pris — à des années-lumière des collections calibrées et sans surprise.

En face, la mécanique est bien huilée : les directions artistiques t'imposent un style, et les équipes marketing matraquent tes réseaux et les panneaux publicitaires pour qu'on s'habille tous pareil — parce que ça coûte moins cher à produire en masse. Le but ? Que tu en veuilles encore l'année prochaine, que tu rachètes, encore et encore.

Passer aux jeunes créatrices, c'est briser cette chaîne. C'est créer un lien fort, de personne à personne. C'est choisir ton propre style au lieu de subir les diktats. Tu portes quelque chose que personne d'autre n'a — le contraire de l'uniforme.`

const AD_SECTION = `## Parce que tu es une pub ambulante — autant bien la choisir

Chaque fois que tu portes une pièce, tu en fais la publicité, dehors, gratuitement. La vraie question, c'est : pour qui veux-tu faire cette pub ? Pour une créatrice qui fabrique de belles choses avec soin — ou pour un groupe qui produit en masse en salissant tout sur son passage ? Ton dos, ton sac, c'est un panneau d'affichage. Autant qu'il porte quelque chose dont tu es fière.

`
const QUOTE_ANCHOR = "> Soutenir une jeune créatrice"

for(const a of articles) if(a.slug==='pourquoi-soutenir-jeunes-creatrices'){
  if(a.body.includes(OLD_UNIQUE)){ a.body=a.body.replace(OLD_UNIQUE,NEW_UNIQUE); console.log('✓ section unique renforcée') }
  else console.log('✗ section unique non trouvée (déjà modifiée ?)')
  if(!a.body.includes('pub ambulante')){ const i=a.body.indexOf(QUOTE_ANCHOR); if(i>-1){ a.body=a.body.slice(0,i)+AD_SECTION+a.body.slice(i); console.log('✓ paragraphe pub ambulante ajouté') } else console.log('✗ ancre citation non trouvée') }
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
