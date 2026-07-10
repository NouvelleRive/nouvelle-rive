import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

// Fleek brouillons : Nike Shorts = lot 3 pieces 0-24, Y2K Skirts = lot 1 pieces 0-7
const fleekIds = []
for (let i = 0; i <= 24; i++) fleekIds.push(`fleek_154621_3_${i}`)
for (let i = 0; i <= 7; i++) fleekIds.push(`fleek_154621_1_${i}`)

for (const id of fleekIds) {
  const ref = db.collection('produits').doc(id)
  const snap = await ref.get()
  if (!snap.exists) {
    console.log(`⚠  ${id} inexistant`)
    continue
  }
  const x = snap.data()
  await ref.update({
    recu: true,
    dateReception: FieldValue.serverTimestamp(),
    achatStatut: 'recu-boutique',
  })
  console.log(`✅ ${id} sku=${x.sku} (${x.achatTitreOriginal || x.nom})`)
}

// Ralph Lauren manuellement créés (NR320-NR339) — pas des brouillons achat,
// juste recu=true suffit.
const rlSnap = await db.collection('produits')
  .where('trigramme', '==', 'NR')
  .where('marque', '==', 'Ralph Lauren')
  .get()
let rlCount = 0
for (const d of rlSnap.docs) {
  const sku = d.data().sku || ''
  const m = sku.match(/^NR(\d+)$/)
  if (!m) continue
  const n = parseInt(m[1], 10)
  if (n < 320 || n > 339) continue
  await d.ref.update({ recu: true, dateReception: FieldValue.serverTimestamp() })
  console.log(`✅ ${d.id} sku=${sku} (Ralph Lauren)`)
  rlCount++
}
console.log(`\n✅ ${fleekIds.length} brouillons Fleek + ${rlCount} Ralph Lauren marqués reçus`)
process.exit(0)
