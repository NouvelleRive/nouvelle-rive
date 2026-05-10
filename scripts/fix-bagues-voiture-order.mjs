import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()
await db.collection('iconiques').doc('bagues-voiture-ines-pineau').update({
  categoriesOrder: ['bague']
})
console.log('OK : bagues d\'abord pour bagues-voiture-ines-pineau')
process.exit(0)
