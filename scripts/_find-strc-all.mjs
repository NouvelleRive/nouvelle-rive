import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync('./scripts/firebase-service-account.json', 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()
const snap = await db.collection('produits')
  .where('sku', '>=', 'STRC').where('sku', '<', 'STRD').get()
console.log('STRC* trouvés:', snap.size)
snap.forEach(d => {
  const p = d.data()
  console.log(`${p.sku}\t| statut:${p.statut} vendu:${p.vendu} q:${p.quantite}\t| ebayOffer:${p.ebayOfferId||'-'} ebayList:${p.ebayListingId||'-'}\t| id:${d.id}`)
})
process.exit(0)
