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

const snap = await db.collection('produits').get()
const candidates = snap.docs.filter(d => d.data().prixBaisseLe && !d.data().etiquetteMaj)
console.log(`📦 ${candidates.length} pièce(s) avec prixBaisseLe sans etiquetteMaj`)

let n = 0
const chunk = 400
for (let i = 0; i < candidates.length; i += chunk) {
  const batch = db.batch()
  const slice = candidates.slice(i, i + chunk)
  for (const d of slice) batch.update(d.ref, { etiquetteMaj: true })
  await batch.commit()
  n += slice.length
  console.log(`  ✓ ${n}/${candidates.length}`)
}

console.log(`✅ ${n} pièce(s) marquée(s) etiquetteMaj=true`)
process.exit(0)
