// Bascule au 1er septembre 2026 la date d'achat des pièces ACH datées d'août :
// les achats d'août et de septembre comptent ensemble dans le P&L.
//
// Usage : node scripts/achat-ach-dates-septembre.mjs [--go]
// STRICTEMENT limité au trigramme ACH. Ne touche JAMAIS aux pièces NR.
import { config } from 'dotenv'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

config({ path: '.env.local' })
if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) })
const db = getFirestore()
const GO = process.argv.includes('--go')
const CIBLE = Timestamp.fromDate(new Date('2026-09-01T12:00:00'))

const snap = await db.collection('produits').get()
const aFaire = []
snap.forEach(d => {
  const p = d.data()
  if ((p.trigramme || '').toUpperCase() !== 'ACH') return
  const t = p.achatDateCommande?.toDate?.()
  if (!t) return
  const iso = t.toISOString().slice(0, 10)
  if (!iso.startsWith('2026-08')) return
  aFaire.push({ ref: d.ref, sku: p.sku, avant: iso })
})

aFaire.sort((a, b) => String(a.sku).localeCompare(String(b.sku)))
aFaire.forEach(x => console.log(`${x.sku} | ${x.avant} → 2026-09-01`))
console.log(`\n${aFaire.length} pièce(s) ACH`)
if (!GO) { console.log('(rien écrit — relance avec --go)'); process.exit(0) }

for (let i = 0; i < aFaire.length; i += 400) {
  const batch = db.batch()
  aFaire.slice(i, i + 400).forEach(x => batch.update(x.ref, { achatDateCommande: CIBLE }))
  await batch.commit()
}
console.log(`✅ ${aFaire.length} pièce(s) basculées au 1er septembre 2026`)
process.exit(0)
