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

const snap = await db.collection('produits').where('sku', '==', 'DISI16').get()
if (snap.empty) {
  console.log('Aucun produit avec SKU exact DISI16')
} else {
  for (const d of snap.docs) {
    const x = d.data()
    console.log('--- id:', d.id)
    console.log('sku:', x.sku)
    console.log('nom:', x.nom)
    console.log('quantite:', x.quantite)
    console.log('vendu:', x.vendu)
    console.log('statut:', x.statut)
    console.log('catalogObjectId:', x.catalogObjectId)
    console.log('variationId:', x.variationId)
    console.log('itemId:', x.itemId)
    console.log('dateVente:', x.dateVente?.toDate?.()?.toISOString() ?? x.dateVente)
    console.log('squareOrderId:', x.squareOrderId)
    console.log('trigramme:', x.trigramme)
    console.log('chineur:', x.chineur)
  }
}

console.log('\n=== Ventes pour SKU DISI16 ===')
const ventesSnap = await db.collection('ventes').where('sku', '==', 'DISI16').get()
if (ventesSnap.empty) {
  console.log('Aucune vente pour DISI16')
} else {
  for (const d of ventesSnap.docs) {
    const x = d.data()
    console.log('vente id:', d.id, '| dateVente:', x.dateVente?.toDate?.()?.toISOString() ?? x.dateVente, '| prix:', x.prixVenteReel)
  }
}
process.exit(0)
