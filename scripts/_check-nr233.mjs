import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

// 1) Vérif doc direct
const doc = await db.collection('produits').doc('fleek_154621_0_0').get()
console.log(`Doc fleek_154621_0_0 exists=${doc.exists}`)
if (doc.exists) {
  const x = doc.data()
  console.log(`  sku=${x.sku} statut=${x.statut} quantite=${x.quantite} chineur=${x.chineur} trigramme=${x.trigramme}`)
  console.log(`  photosReady=${x.photosReady} recu=${x.recu} achatStatut=${x.achatStatut}`)
  console.log(`  categorie=`, x.categorie)
}

// 2) Cherche par sku=NR233
const snap = await db.collection('produits').where('sku', '==', 'NR233').get()
console.log(`\nQuery sku=NR233 → ${snap.size} matches`)
snap.forEach(d => console.log(`  ${d.id} statut=${d.data().statut}`))

// 3) Tous les produits Ralph Lauren
const snap2 = await db.collection('produits').where('marque', '==', 'Ralph Lauren').get()
console.log(`\nQuery marque=Ralph Lauren → ${snap2.size} matches`)
snap2.forEach(d => {
  const x = d.data()
  console.log(`  ${d.id} sku=${x.sku} statut=${x.statut} quantite=${x.quantite}`)
})
process.exit(0)
