// Patch ciblé (sans reseed) : section Shein + sources sur les 2 articles fast fashion.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  })
}
const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get()
const articles = snap.data().articles

const SHEIN_SECTION = `## Elle vole le travail des jeunes créatrices

Il y a aussi ce qu'on dénonce trop peu : la fast fashion copie. Des géants comme Shein sont accusés, à de multiples reprises et jusque devant les tribunaux, de reprendre les créations d'artistes et de créatrices indépendantes — imprimés, bijoux, coupes, illustrations — pour les produire en masse en quelques jours, sans crédit ni rémunération. D'un côté le talent et des mois de travail ; de l'autre, le pillage industrialisé. Chez Nouvelle Rive, on fait exactement l'inverse : on met les jeunes créatrices en lumière et on protège leur travail, au lieu de le laisser se faire voler.

`

const SOURCES = [
  { label: 'ADEME — La mode sans dessus dessous', url: 'https://www.ademe.fr' },
  { label: 'Oxfam France — Impact de la fast fashion', url: 'https://www.oxfamfrance.org' },
  { label: 'Ellen MacArthur Foundation — A new textiles economy', url: 'https://www.ellenmacarthurfoundation.org' },
]

for (const a of articles) {
  if (a.slug === 'pourquoi-detester-fast-fashion') {
    if (!a.body.includes('vole le travail des jeunes créatrices')) {
      a.body = a.body.replace('> On ne déteste pas la mode.', SHEIN_SECTION + '> On ne déteste pas la mode.')
      console.log('✓ section Shein insérée')
    } else {
      console.log('· section Shein déjà présente')
    }
    a.sources = SOURCES
    console.log('✓ sources ajoutées à pourquoi-detester-fast-fashion')
  }
  if (a.slug === 'vintage-plutot-que-fast-fashion') {
    a.sources = SOURCES
    console.log('✓ sources ajoutées à vintage-plutot-que-fast-fashion')
  }
}

await ref.set({ articles })
try {
  await getStorage().bucket().file('_cache/journal.json.gz').delete()
  console.log('✓ blob cache vidé')
} catch { console.log('· blob absent') }
console.log(`\nTotal articles: ${articles.length}`)
process.exit(0)
