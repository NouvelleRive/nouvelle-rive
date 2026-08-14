import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()
const p = (await db.collection('produits').doc('CAS39').get()).data()
console.log(JSON.stringify({ebayListingId:p.ebayListingId,ebayOfferId:p.ebayOfferId,ebaySku:p.ebaySku,sku:p.sku,publieEbay:p.publieEbay,canaux:p.canaux},null,2))
process.exit(0)
