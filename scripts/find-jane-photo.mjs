// Cherche les produits AGE blazer "Jane" et les liste avec leur image
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const snap = await db.collection('produits').where('trigramme', '==', 'AGE').get()
const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
const janes = all.filter(p => /jane/i.test(p.nom || '') || /jane/i.test(p.modele || ''))
console.log(`${janes.length} produits AGE "Jane" :`)
for (const p of janes) {
  const img = p.photos?.face || p.imageUrls?.[0] || p.imageUrl || ''
  const status = p.vendu ? '🔴 vendu' : (p.quantite ?? 1) > 0 ? '🟢 stock' : '🟡 indispo'
  console.log(`  ${p.sku || p.id} ${status}: ${p.nom?.slice(0, 60)}`)
  console.log(`    ${img}`)
}
process.exit(0)
