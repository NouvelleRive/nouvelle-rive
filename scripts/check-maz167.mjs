import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync('/Users/salomekassabi/Desktop/nouvelle-rive/scripts/firebase-service-account.json', 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const snap = await db.collection('ventes').where('sku', '==', 'MAZ167').get()
console.log(`\n=== ${snap.size} vente(s) trouvée(s) pour SKU=MAZ167 ===\n`)

for (const d of snap.docs) {
  const v = d.data()
  console.log('---', d.id, '---')
  console.log('  source       :', v.source)
  console.log('  orderId      :', v.orderId)
  console.log('  lineItemUid  :', v.lineItemUid)
  console.log('  prixVenteReel:', v.prixVenteReel)
  console.log('  prixInitial  :', v.prixInitial)
  console.log('  dateVente    :', v.dateVente?.toDate?.()?.toISOString?.() || v.dateVente)
  console.log('  createdAt    :', v.createdAt?.toDate?.()?.toISOString?.() || v.createdAt)
  console.log('  attribue     :', v.attribue)
  console.log('  chineurUid   :', v.chineurUid)
  console.log('  nom          :', v.nom)
  console.log('  trigramme    :', v.trigramme)
  console.log('  produitId    :', v.produitId)
}

process.exit(0)
