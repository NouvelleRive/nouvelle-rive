// Baisse -20% (arrondi 5 €) + reset prixBaisseLe = maintenant
// sur les pièces NR au badge orange (en boutique > 2 mois, jamais baissées).
// Usage :
//   node scripts/_apply-nr-baisse-20-orange.mjs         → DRY-RUN
//   node scripts/_apply-nr-baisse-20-orange.mjs --apply → écrit dans Firestore

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

const twoMonthsAgo = new Date()
twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

const snap = await db.collection('produits').where('trigramme', '==', 'NR').get()

const cibles = []
for (const d of snap.docs) {
  const p = d.data()
  if (p.recu !== true) continue
  if (p.statut === 'vendu' || p.statut === 'retour' || p.statut === 'supprime') continue
  if (p.vendu === true) continue
  if (p.prixBaisseLe) continue // déjà baissée = rouge ou bleu, pas orange
  if (p.statutRecuperation) continue
  const dateRecept = p.dateReception?.toDate?.()
  if (!dateRecept || dateRecept >= twoMonthsAgo) continue // < 2 mois = pas orange

  const ancien = p.prix
  if (typeof ancien !== 'number' || ancien <= 0) continue
  const nouveau = Math.round((ancien * 0.8) / 5) * 5 // -20% arrondi au 5 €
  if (nouveau >= ancien) continue

  cibles.push({ id: d.id, sku: p.sku, nom: p.nom, ancien, nouveau, dateRecept })
}

cibles.sort((a, b) => a.sku.localeCompare(b.sku, 'fr', { numeric: true }))

console.log(`\n${APPLY ? '✍️  APPLY' : '👀 DRY-RUN'} — ${cibles.length} pièce(s) NR orange à baisser -20%\n`)
for (const c of cibles) {
  const dStr = c.dateRecept.toISOString().slice(0, 10)
  console.log(`  ${c.sku.padEnd(8)} ${String(c.ancien + ' €').padStart(7)} → ${String(c.nouveau + ' €').padStart(6)}  (reçu ${dStr})  ${c.nom}`)
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
    etiquetteMaj: false,
  })
  done++
}
console.log(`\n✅ ${done} pièce(s) mises à jour dans Firestore.`)
process.exit(0)
