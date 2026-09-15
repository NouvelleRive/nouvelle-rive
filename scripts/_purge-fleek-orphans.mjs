import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

// On cible EXCLUSIVEMENT les 25 docs du lot 0 de la facture Fleek #154621
// (les 20 Ralph Lauren "supprime" + 5 Nike orphelins).
const ids = []
for (let i = 0; i <= 24; i++) ids.push(`fleek_154621_0_${i}`)

for (const id of ids) {
  const ref = db.collection('produits').doc(id)
  const snap = await ref.get()
  if (!snap.exists) {
    console.log(`⚠  ${id} — inexistant, skip`)
    continue
  }
  const x = snap.data()
  console.log(`🗑  ${id} sku=${x.sku} statut=${x.statut} titre=${x.achatTitreOriginal || x.nom}`)
  await ref.delete()
}
console.log(`\n✅ Purge terminée (${ids.length} tentatives)`)
process.exit(0)
