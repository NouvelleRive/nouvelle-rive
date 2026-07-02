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

// Toutes les pièces avec prixBaisseLe défini
const snap = await db.collection('produits').where('baisse20Done', '==', true).get()
console.log(`\n📦 ${snap.size} pièce(s) avec baisse20Done = true`)

const problematiques = []
const okMaisVieilles = []

for (const d of snap.docs) {
  const p = d.data()
  if (p.statut === 'vendu' || p.statut === 'retour' || p.statut === 'supprime') continue
  const baisse = p.prixBaisseLe?.toMillis?.()
  const reception = p.dateReception?.toMillis?.()
  if (!baisse) continue

  const info = {
    id: d.id,
    sku: p.sku,
    trigramme: p.trigramme,
    prixActuel: p.prix,
    ancienPrix: p.ancienPrix,
    createdAt: p.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 10),
    dateReception: p.dateReception?.toDate?.()?.toISOString?.()?.slice(0, 10),
    prixBaisseLe: p.prixBaisseLe?.toDate?.()?.toISOString?.()?.slice(0, 10),
    notifJ30SentAt: p.notifJ30SentAt?.toDate?.()?.toISOString?.()?.slice(0, 10),
  }

  // Cas problématique : baisse appliquée avant la réception OU pas de dateReception
  if (!reception || baisse < reception) {
    problematiques.push(info)
  } else {
    okMaisVieilles.push(info)
  }
}

console.log(`\n❌ ${problematiques.length} pièce(s) BAISSÉE AVANT RÉCEPTION (bug ancien cron) :`)
const parTri = {}
for (const p of problematiques) {
  const tri = p.trigramme || '?'
  parTri[tri] ||= []
  parTri[tri].push(p)
}
for (const tri of Object.keys(parTri).sort()) {
  console.log(`  ${tri} : ${parTri[tri].length} pièce(s)`)
  for (const p of parTri[tri].slice(0, 3)) {
    console.log(`    ${p.sku} | created=${p.createdAt} | reception=${p.dateReception} | baisse=${p.prixBaisseLe} | prix=${p.prixActuel} (avant ${p.ancienPrix})`)
  }
  if (parTri[tri].length > 3) console.log(`    + ${parTri[tri].length - 3} autres`)
}

console.log(`\n✅ ${okMaisVieilles.length} pièce(s) baissées normalement (après réception)`)

process.exit(0)
