import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sa = JSON.parse(readFileSync(resolve(__dirname, 'firebase-service-account.json'), 'utf8'))
initializeApp({ credential: cert(sa) })
const db = getFirestore()

const MARQUES_ICONIQUES = ['Burberry', 'Chanel', 'Hermès', "Levi's"]

for (const m of MARQUES_ICONIQUES) {
  const snap = await db.collection('produits').where('marque', '==', m).limit(5).get()
  console.log(`Marque "${m}" → ${snap.size} match (exact)`)
  snap.forEach(d => console.log(`   - ${d.data().sku} : marque="${d.data().marque}"`))

  const all = await db.collection('produits').get()
  const variants = new Set()
  all.forEach(d => {
    const mq = (d.data().marque || '').trim()
    if (mq.toLowerCase() === m.toLowerCase()) variants.add(mq)
  })
  console.log(`   Variantes existantes en base (toutes casses) : ${[...variants].map(v => `"${v}"`).join(', ') || '(aucune)'}`)
  console.log('')
}
process.exit(0)
