// Renomme les pièces ACH d'id `vinted_…` vers leur SKU (URL publique = SKU).
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') }) })
const db = getFirestore()
const s = await db.collection('produits').where('trigramme','==','ACH').get()
let n = 0
for (const d of s.docs.filter(d => d.id.startsWith('vinted_'))) {
  const sku = d.data().sku
  if (!/^ACH\d+$/.test(sku || '')) { console.log('skip', d.id, sku); continue }
  const sub = await d.ref.listCollections(); if (sub.length) { console.log('skip subcoll', d.id); continue }
  const ventes = await db.collection('ventes').where('produitId','==',d.id).get()
  await db.runTransaction(async tx => {
    const neu = db.collection('produits').doc(sku)
    if ((await tx.get(neu)).exists) throw new Error('collision ' + sku)
    tx.create(neu, d.data())
    ventes.docs.forEach(v => tx.update(v.ref, { produitId: sku }))
    tx.delete(d.ref)
  })
  n++; console.log(d.id, '→', sku, ventes.size ? `(${ventes.size} vente)` : '')
}
console.log('migrés:', n)
