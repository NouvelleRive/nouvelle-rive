import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const snap = await db.collection('iconiques').get()
console.log(`${snap.size} iconiques`)
snap.docs.forEach(d => {
  const x = d.data()
  console.log(`  id=${d.id}  nom="${x.nom}"  nomEn="${x.nomEn || ''}"  type=${x.type || ''}`)
})
process.exit(0)
