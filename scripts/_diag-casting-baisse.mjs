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

// 1) Retrouver la chineuse/déposante "Casting" et son trigramme
const chSnaps = await Promise.all([
  db.collection('chineuse').get(),
  db.collection('deposante').get().catch(() => ({ docs: [] })),
])
console.log('\n🔎 Recherche "casting" dans chineuse/deposante :')
for (const snap of chSnaps) {
  for (const d of snap.docs) {
    const c = d.data()
    const blob = JSON.stringify(c).toLowerCase()
    if (blob.includes('casting')) {
      console.log(`  → ${d.ref.parent.id}/${d.id}  nom=${c.nom || c.prenom || c.name || '?'}  trigramme=${c.trigramme}  stockType=${c.stockType || '-'}`)
    }
  }
}

// 2) Toutes les pièces avec prixBaisseLe défini : détecter les baisses "prématurées"
//    (prixBaisseLe posé alors que dateReception < 2 mois avant la baisse)
const snap = await db.collection('produits').get()
const TWO_MONTHS_MS = 1000 * 60 * 60 * 24 * 61 // ~2 mois
const premature = []
for (const d of snap.docs) {
  const p = d.data()
  if (['vendu', 'retour', 'supprime', 'outOfStock'].includes(p.statut)) continue
  if (p.vendu === true) continue
  const baisse = p.prixBaisseLe?.toMillis?.()
  const reception = p.dateReception?.toMillis?.()
  if (!baisse) continue
  // Baisse posée moins de 2 mois après la réception = prématurée (bug ajustement de prix)
  if (reception && baisse - reception < TWO_MONTHS_MS) {
    premature.push({
      id: d.id,
      sku: p.sku,
      trigramme: p.trigramme,
      dateReception: p.dateReception?.toDate?.()?.toISOString?.()?.slice(0, 10),
      prixBaisseLe: p.prixBaisseLe?.toDate?.()?.toISOString?.()?.slice(0, 10),
      joursAvant: Math.round((baisse - reception) / 86400000),
      prix: p.prix,
      ancienPrix: p.ancienPrix,
    })
  }
}
premature.sort((a, b) => (a.trigramme || '').localeCompare(b.trigramme || ''))
console.log(`\n⚠️  ${premature.length} pièce(s) avec baisse PRÉMATURÉE (< 2 mois après réception) :`)
const parTri = {}
for (const p of premature) { (parTri[p.trigramme || '?'] ||= []).push(p) }
for (const tri of Object.keys(parTri).sort()) {
  console.log(`\n  ${tri} : ${parTri[tri].length} pièce(s)`)
  for (const p of parTri[tri]) {
    console.log(`    ${p.sku}  reçu=${p.dateReception}  baissé=${p.prixBaisseLe} (+${p.joursAvant}j)  prix=${p.prix}€ (ancien ${p.ancienPrix}€)`)
  }
}
console.log('\n(Lecture seule — rien modifié.)')
