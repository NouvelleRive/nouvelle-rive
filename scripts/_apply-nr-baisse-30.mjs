// Baisse -30% (arrondi 5 €) + reset prixBaisseLe = maintenant
// sur les pièces NR au badge rouge (prix baissé > 1 mois).
// Usage :
//   node scripts/_apply-nr-baisse-30.mjs         → DRY-RUN
//   node scripts/_apply-nr-baisse-30.mjs --apply → écrit dans Firestore

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })

const APPLY = process.argv.includes('--apply')

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}
const db = getFirestore()

const oneMonthAgo = new Date()
oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

const snap = await db.collection('produits').where('trigramme', '==', 'NR').get()

const cibles = []
for (const d of snap.docs) {
  const p = d.data()
  if (p.recu !== true) continue
  if (p.statut === 'vendu' || p.statut === 'retour' || p.statut === 'supprime') continue
  const baisseDate = p.prixBaisseLe?.toDate?.()
  if (!baisseDate || baisseDate >= oneMonthAgo) continue

  const ancien = p.prix
  const nouveau = Math.round((ancien * 0.7) / 5) * 5 // -30% arrondi au 5 €
  if (nouveau >= ancien) continue // sécurité : jamais monter

  cibles.push({ id: d.id, sku: p.sku, nom: p.nom, ancien, nouveau })
}

cibles.sort((a, b) => a.sku.localeCompare(b.sku, 'fr', { numeric: true }))

console.log(`\n${APPLY ? '✍️  APPLY' : '👀 DRY-RUN'} — ${cibles.length} pièce(s) NR à baisser -30%\n`)
for (const c of cibles) {
  console.log(`  ${c.sku.padEnd(8)} ${String(c.ancien + ' €').padStart(7)} → ${String(c.nouveau + ' €').padStart(6)}  ${c.nom}`)
}
const totalAv = cibles.reduce((s, c) => s + c.ancien, 0)
const totalAp = cibles.reduce((s, c) => s + c.nouveau, 0)
console.log(`\nTotal ${totalAv} € → ${totalAp} € (delta ${totalAv - totalAp} €)`)

if (!APPLY) {
  console.log(`\nRe-lance avec --apply pour écrire.`)
  process.exit(0)
}

const now = Timestamp.now()
let done = 0
for (const c of cibles) {
  await db.collection('produits').doc(c.id).update({
    prix: c.nouveau,
    ancienPrix: c.ancien,
    prixBaisseLe: now,
    etiquetteMaj: false, // étiquette physique boutique à refaire
  })
  done++
}
console.log(`\n✅ ${done} pièce(s) mises à jour dans Firestore.`)
process.exit(0)
