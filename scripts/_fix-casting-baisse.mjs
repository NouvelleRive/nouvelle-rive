import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { config } from 'dotenv'
import { writeFileSync } from 'fs'
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

const APPLY = process.argv.includes('--apply')
const TRI = 'CAS' // Casting

// Pièces CAS actives dont le chrono a été armé à tort (baisse < 2 mois après réception)
const snap = await db.collection('produits').where('trigramme', '==', TRI).get()
const TWO_MONTHS_MS = 61 * 24 * 3600 * 1000
const cibles = []
for (const d of snap.docs) {
  const p = d.data()
  if (['vendu', 'retour', 'supprime', 'outOfStock'].includes(p.statut)) continue
  if (p.vendu === true) continue
  const baisse = p.prixBaisseLe?.toMillis?.()
  const reception = p.dateReception?.toMillis?.()
  if (!baisse) continue
  // baisse prématurée : posée moins de 2 mois après la réception
  if (!reception || baisse - reception < TWO_MONTHS_MS) {
    cibles.push({ id: d.id, data: p })
  }
}

console.log(`\n${cibles.length} pièce(s) ${TRI} à corriger (effacer prixBaisseLe + ancienPrix, garder le prix) :`)
for (const c of cibles) {
  console.log(`  ${c.data.sku}  prix=${c.data.prix}€  (ancienPrix ${c.data.ancienPrix ?? '-'}€, baissé ${c.data.prixBaisseLe?.toDate?.()?.toISOString?.().slice(0,10)})`)
}

// Sauvegarde réversible des valeurs effacées
const backup = cibles.map(c => ({
  id: c.id, sku: c.data.sku,
  prixBaisseLe: c.data.prixBaisseLe?.toDate?.()?.toISOString?.() || null,
  ancienPrix: c.data.ancienPrix ?? null,
}))

if (!APPLY) {
  console.log('\n🔎 DRY-RUN — rien écrit. Relance avec --apply pour appliquer.')
  process.exit(0)
}

const backupPath = new URL('../scripts/_fix-casting-baisse.backup.json', import.meta.url).pathname
writeFileSync(backupPath, JSON.stringify(backup, null, 2))
console.log(`\n💾 Backup écrit : ${backupPath}`)

let n = 0
for (const c of cibles) {
  await db.collection('produits').doc(c.id).update({
    prixBaisseLe: FieldValue.delete(),
    ancienPrix: FieldValue.delete(),
  })
  n++
}
console.log(`\n✅ ${n} pièce(s) ${TRI} corrigée(s). Le prix affiché est conservé, plus de "prix baissé / à récupérer".`)
