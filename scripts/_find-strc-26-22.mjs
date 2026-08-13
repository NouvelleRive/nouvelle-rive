import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync('./scripts/firebase-service-account.json', 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const skus = ['STRC26', 'STRC22']
for (const sku of skus) {
  const snap = await db.collection('produits').where('sku', '==', sku).get()
  if (snap.empty) { console.log(`❌ ${sku} : aucun doc`); continue }
  snap.forEach(d => {
    const p = d.data()
    console.log(`\n=== ${sku} ===`)
    console.log('  docId:', d.id)
    console.log('  nom:', p.nom || p.titre)
    console.log('  statut:', p.statut, '| vendu:', p.vendu, '| quantite:', p.quantite)
    console.log('  ebayOfferId:', p.ebayOfferId || '-', '| ebayListingId:', p.ebayListingId || '-')
  })
}
process.exit(0)
