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

const snap = await db.collection('produits').where('statutRecuperation', '==', 'aRecuperer').get()
console.log(`\n📦 ${snap.size} pièce(s) avec statutRecuperation === 'aRecuperer'`)

if (snap.size > 0) {
  // Groupé par chineuse
  const parTri = {}
  for (const d of snap.docs) {
    const p = d.data()
    if (p.statut === 'retour' || p.statut === 'supprime') continue
    const tri = (p.trigramme || '?').toUpperCase()
    parTri[tri] ||= []
    parTri[tri].push({ id: d.id, sku: p.sku, nom: p.nom, dateDemande: p.dateDemandeRecuperation?.toDate?.() })
  }
  const triNoms = Object.keys(parTri).sort()
  console.log(`Par chineuse :`)
  for (const tri of triNoms) {
    console.log(`  ${tri} : ${parTri[tri].length} pièce(s)`)
    for (const p of parTri[tri].slice(0, 5)) {
      const dStr = p.dateDemande ? p.dateDemande.toISOString().slice(0, 10) : '?'
      console.log(`    - ${p.sku} (${dStr})`)
    }
    if (parTri[tri].length > 5) console.log(`    + ${parTri[tri].length - 5} autres`)
  }
}

process.exit(0)
