// Liste les pièces NR "rouge" = prix déjà baissé, > 1 mois sans se vendre.
// Logique alignée sur getPriceBadgeStatus() dans ProductList.tsx.
// LECTURE SEULE — n'écrit rien.

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })

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
console.log(`\n📦 ${snap.size} pièces NR au total, filtrage badge rouge (prix baissé > 1 mois)…\n`)

const rouge = []
for (const d of snap.docs) {
  const p = d.data()
  if (p.recu !== true) continue
  if (p.statut === 'vendu' || p.statut === 'retour' || p.statut === 'supprime') continue
  const baisseDate = p.prixBaisseLe?.toDate?.()
  if (!baisseDate || baisseDate >= oneMonthAgo) continue
  rouge.push({
    id: d.id,
    sku: p.sku,
    nom: p.nom,
    prix: p.prix,
    baisseLe: baisseDate,
  })
}

rouge.sort((a, b) => a.baisseLe - b.baisseLe)

console.log(`🚨 ${rouge.length} pièce(s) NR rouge :\n`)
for (const p of rouge) {
  const dStr = p.baisseLe.toISOString().slice(0, 10)
  const nouveauPrix = Math.round(p.prix * 0.7)
  console.log(`  • ${p.sku} — ${p.prix} € → ${nouveauPrix} € (baissé le ${dStr}) — ${p.nom}`)
}

const total = rouge.reduce((s, p) => s + p.prix, 0)
const totalApres = rouge.reduce((s, p) => s + Math.round(p.prix * 0.7), 0)
console.log(`\nTotal actuel : ${total} € → après -30% : ${totalApres} € (delta ${total - totalApres} €)`)

process.exit(0)
