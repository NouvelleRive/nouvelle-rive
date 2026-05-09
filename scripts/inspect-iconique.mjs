import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const id = process.argv[2]
if (!id) { console.error('usage: node scripts/inspect-iconique.mjs <id>'); process.exit(1) }
const doc = await db.collection('iconiques').doc(id).get()
if (!doc.exists) { console.log('not found'); process.exit(0) }
console.log(JSON.stringify(doc.data(), null, 2))
process.exit(0)
