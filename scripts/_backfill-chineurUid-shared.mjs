import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })

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

const DRY_RUN = process.argv.includes('--dry')

const chSnap = await db.collection('chineuse').get()
const shared = chSnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(c => Array.isArray(c.emails) && c.emails.length >= 2 && c.trigramme)

console.log(`Comptes chineuse partagés : ${shared.length}`)
console.log(shared.map(c => `${c.trigramme}→${c.id}`).join(', '))
console.log(DRY_RUN ? '\n[DRY RUN — aucune écriture]' : '\n[ÉCRITURES ACTIVES]')

let totalUpdated = 0
for (const c of shared) {
  const prodSnap = await db.collection('produits').where('trigramme', '==', c.trigramme).get()
  const toFix = prodSnap.docs.filter(d => d.data().chineurUid && d.data().chineurUid !== c.id)
  console.log(`\n${c.trigramme} : ${toFix.length}/${prodSnap.docs.length} à réaligner sur "${c.id}"`)

  if (!toFix.length || DRY_RUN) continue

  // Batches de 400 (limite Firestore = 500)
  for (let i = 0; i < toFix.length; i += 400) {
    const batch = db.batch()
    const slice = toFix.slice(i, i + 400)
    slice.forEach(d => batch.update(d.ref, { chineurUid: c.id }))
    await batch.commit()
    console.log(`  ✓ batch ${i / 400 + 1} : ${slice.length} produits`)
  }
  totalUpdated += toFix.length
}

console.log(`\n${DRY_RUN ? 'Simulés' : 'Mis à jour'} : ${totalUpdated} produits`)
process.exit(0)
