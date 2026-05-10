import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()
const ref = db.collection('iconiques').doc('bagues-voiture-ines-pineau')
const before = (await ref.get()).data().videos || []
console.log(`AVANT (${before.length}):`)
before.forEach((v, i) => console.log(`  ${i+1}. ${v}`))
const after = before.slice(1)
await ref.update({ videos: after })
console.log(`\nAPRÈS (${after.length}):`)
after.forEach((v, i) => console.log(`  ${i+1}. ${v}`))
process.exit(0)
