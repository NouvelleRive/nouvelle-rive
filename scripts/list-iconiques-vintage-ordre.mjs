import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const snap = await db.collection('iconiques').get()
const vintage = snap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(x => (x.type || 'vintage') === 'vintage')
  .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))

vintage.forEach(x => {
  console.log(`  ordre=${x.ordre}  id=${x.id}  nom="${x.nom}"  imgs=${(x.images || []).length}`)
})
process.exit(0)
