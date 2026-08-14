import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()
const s = await db.collection('produits').where('sku','==','CAM82').get()
s.forEach(d=>console.log('docId=',d.id,'sku=',d.data().sku,'ebayListingId=',d.data().ebayListingId))
process.exit(0)
