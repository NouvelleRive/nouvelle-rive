// Backfill : compte les likes de chaque produit dans la collection 'favoris'
// et écrit le total dans produits.likesCount
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const dryRun = process.argv.includes('--apply') ? false : true
console.log(dryRun ? '🟡 DRY RUN (ajouter --apply)' : '🟢 APPLY')

const favSnap = await db.collection('favoris').get()
const counts = new Map()
favSnap.docs.forEach(d => {
  const pid = d.data().productId
  if (!pid) return
  counts.set(pid, (counts.get(pid) || 0) + 1)
})
console.log(`${counts.size} produits ont au moins 1 like`)

let nbUpdated = 0, nbMissing = 0
for (const [pid, n] of counts.entries()) {
  const ref = db.collection('produits').doc(pid)
  const snap = await ref.get()
  if (!snap.exists) {
    console.log(`  ⚠️  ${pid} → produit n'existe plus, like orphelin`)
    nbMissing++
    continue
  }
  const p = snap.data()
  console.log(`  ${p.sku || pid}: ${p.likesCount ?? 0} → ${n}`)
  if (!dryRun) await ref.update({ likesCount: n })
  nbUpdated++
}
console.log(`\n${nbUpdated} produits mis à jour, ${nbMissing} likes orphelins`)
process.exit(0)
