import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync('./scripts/firebase-service-account.json', 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const docId = 'DVcioRPnLapW2JoPS4VqGdt8hmDZY_a063da21-37d9-4ca7-90eb-f1b7695a0fac'
const ref = db.collection('ventes').doc(docId)
const snap = await ref.get()
if (!snap.exists) {
  console.log('❌ Doc introuvable:', docId)
  process.exit(1)
}
const v = snap.data()
console.log('À supprimer :', docId)
console.log('  sku:', v.sku, '| orderId:', v.orderId, '| date:', v.dateVente?.toDate?.()?.toISOString?.())
await ref.delete()
console.log('✅ Supprimé')
process.exit(0)
