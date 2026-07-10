import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const skus = ['DV37', 'DV35', 'DV34', 'DV24', 'DV20', 'DV17', 'DV16', 'DV13', 'DV4']
const dateRecu = Timestamp.fromDate(new Date('2025-12-03T12:00:00+01:00'))

for (const sku of skus) {
  const snap = await db.collection('produits').where('sku', '==', sku).get()
  if (snap.empty) {
    console.log(`⚠  ${sku} introuvable`)
    continue
  }
  for (const d of snap.docs) {
    await d.ref.update({ recu: true, dateReception: dateRecu })
    console.log(`✅ ${sku} (doc ${d.id})`)
  }
}
process.exit(0)
