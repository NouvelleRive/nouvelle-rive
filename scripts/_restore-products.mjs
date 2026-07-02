import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
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

const SKUS = ['NR106', 'PP338']
for (const sku of SKUS) {
  const snap = await db.collection('produits').where('sku', '==', sku).limit(1).get()
  if (snap.empty) {
    console.log(`❌ ${sku} introuvable`)
    continue
  }
  const doc = snap.docs[0]
  const d = doc.data()
  console.log(`📦 ${sku} — vendu=${d.vendu}, qte=${d.quantite}, statut=${d.statut || '-'}, dateVente=${d.dateVente ? 'oui' : 'non'}`)
  const updates = {
    vendu: false,
    quantite: (d.quantite || 0) + 1,
    dateVente: FieldValue.delete(),
    prixVenteReel: FieldValue.delete(),
  }
  if (d.statut === 'outOfStock' || d.statut === 'vendu') updates.statut = FieldValue.delete()
  await doc.ref.update(updates)
  console.log(`  ✓ restauré`)
}
process.exit(0)
