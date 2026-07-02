import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
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

const dryRun = process.argv.includes('--apply') ? false : true

// Pièces UPZ avec prixBaisseLe ANTÉRIEUR à dateReception → bug ancien cron
const snap = await db.collection('produits').where('trigramme', '==', 'UPZ').get()

const aFixer = []
for (const d of snap.docs) {
  const p = d.data()
  if (!p.prixBaisseLe) continue
  const baisse = p.prixBaisseLe.toMillis()
  const reception = p.dateReception?.toMillis?.()
  if (reception && baisse >= reception) continue
  aFixer.push({
    id: d.id,
    sku: p.sku,
    prixActuel: p.prix,
    ancienPrix: p.ancienPrix,
    dateReception: p.dateReception?.toDate?.()?.toISOString?.()?.slice(0, 10),
    prixBaisseLe: p.prixBaisseLe.toDate().toISOString().slice(0, 10),
  })
}

console.log(`\n${dryRun ? '[DRY-RUN]' : '[APPLY]'} ${aFixer.length} pièce(s) UPZ à nettoyer :`)
for (const p of aFixer) {
  console.log(`  ${p.sku} | prix=${p.prixActuel}€ (INTACT) | delete prixBaisseLe=${p.prixBaisseLe} + ancienPrix=${p.ancienPrix}`)
}

if (!dryRun) {
  for (const p of aFixer) {
    await db.collection('produits').doc(p.id).update({
      prixBaisseLe: FieldValue.delete(),
      baisse20Done: FieldValue.delete(),
      ancienPrix: FieldValue.delete(),
    })
  }
  console.log(`\n✅ ${aFixer.length} pièce(s) nettoyée(s)`)
} else {
  console.log(`\n👉 Relance avec --apply pour appliquer`)
}

process.exit(0)
