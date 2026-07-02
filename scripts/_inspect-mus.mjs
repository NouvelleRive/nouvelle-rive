import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}
const db = getFirestore()

const snap = await db.collection('produits').where('trigramme', '==', 'MUS').get()
for (const d of snap.docs) {
  const p = d.data()
  console.log(`\n=== ${p.sku} ===`)
  console.log('nom         :', JSON.stringify(p.nom))
  console.log('categorie   :', JSON.stringify(p.categorie))
  console.log('couleur     :', JSON.stringify(p.couleur))
  console.log('couleurs    :', JSON.stringify(p.couleurs))
  console.log('color       :', JSON.stringify(p.color))
  console.log('matiere     :', JSON.stringify(p.matiere))
  console.log('matière     :', JSON.stringify(p['matière']))
  console.log('material    :', JSON.stringify(p.material))
  console.log('marque      :', JSON.stringify(p.marque))
  console.log('brand       :', JSON.stringify(p.brand))
}
process.exit(0)
