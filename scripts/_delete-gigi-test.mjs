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

const snap = await db.collection('produits').where('trigramme', '==', 'GIGI').get()
const testProducts = snap.docs.filter(d => {
  const data = d.data()
  const desc = String(data.description || '').toLowerCase()
  return desc.startsWith('produit test')
})

console.log(`Trouvés : ${testProducts.length} pièces test chez GIGI`)
testProducts.forEach(d => console.log(`  - ${d.data().sku}: ${d.data().description}`))

if (testProducts.length === 0) { process.exit(0) }

for (const d of testProducts) {
  await d.ref.delete()
  console.log(`✗ supprimé ${d.data().sku}`)
}

console.log(`\n✅ ${testProducts.length} pièces test supprimées`)
process.exit(0)
