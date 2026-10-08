// Pose `achatDateCommande` sur les pièces achat qui n'en ont pas, en reprenant
// leur date de création (`createdAt`). Sans cette date, la pièce est imputée au
// mois de sa saisie dans le P&L acheteuse, et le champ reste vide dans la fiche
// — donc incorrigeable à la main.
//
// Usage : node scripts/achat-backfill-date.mjs [--go]
//   sans --go : liste seulement ce qui serait écrit.
//
// STRICTEMENT limité au trigramme ACH. Ne touche JAMAIS aux pièces NR.
import { config } from 'dotenv'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

config({ path: '.env.local' })
if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) })
const db = getFirestore()
const GO = process.argv.includes('--go')

const snap = await db.collection('produits').get()
const aFaire = []
snap.forEach(d => {
  const p = d.data()
  // Trigramme ACH uniquement — jamais NR.
  if ((p.trigramme || '').toUpperCase() !== 'ACH') return
  if (p.achatDateCommande) return
  if (!p.createdAt) return
  aFaire.push({ ref: d.ref, sku: p.sku, source: p.source || '(aucune)', createdAt: p.createdAt })
})

aFaire.sort((a, b) => String(a.sku).localeCompare(String(b.sku)))
for (const x of aFaire) {
  console.log(`${x.sku} | ${x.source} | date d'achat → ${x.createdAt.toDate().toISOString().slice(0, 10)}`)
}
console.log(`\n${aFaire.length} pièce(s) sans date d'achat`)

if (!GO) {
  console.log('(rien écrit — relance avec --go)')
  process.exit(0)
}

for (let i = 0; i < aFaire.length; i += 400) {
  const batch = db.batch()
  for (const x of aFaire.slice(i, i + 400)) {
    batch.update(x.ref, { achatDateCommande: x.createdAt })
  }
  await batch.commit()
}
console.log(`✅ ${aFaire.length} pièce(s) mises à jour`)
process.exit(0)
