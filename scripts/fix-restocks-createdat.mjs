// Patch les produits déjà restockés (dateRestock présent) :
// - createdAt = dateRestock pour les remettre en "new-in"
// - vendu = false (au cas où un endpoint l'aurait posé à tort sur smallBatch)
// - statut: 'active' si statut était outOfStock alors que la qty est > 0
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const dryRun = process.argv.includes('--apply') ? false : true

const snap = await db.collection('produits').where('dateRestock', '!=', null).get()
console.log(`${snap.size} produits avec dateRestock`)
console.log(dryRun ? '🟡 DRY RUN (ajouter --apply pour exécuter)' : '🟢 APPLY')
console.log('')

const now = Timestamp.now()
let nbPatch = 0, nbSkipQty0 = 0
for (const d of snap.docs) {
  const p = d.data()
  const qty = p.quantite ?? 0
  // Sauter les pièces épuisées (qty=0) — pas de raison de les remonter
  if (qty <= 0) { nbSkipQty0++; continue }

  const updates = { createdAt: now }
  if (p.vendu === true) updates.vendu = false
  if (p.statut === 'outOfStock') updates.statut = 'active'

  nbPatch++
  const date = p.dateRestock?.toDate?.()?.toISOString?.()?.slice(0,10) || '?'
  console.log(`  ${p.sku} qty=${qty} restock=${date} → ${Object.keys(updates).join(', ')}`)
  if (!dryRun) await d.ref.update(updates)
}
console.log(`\n${nbPatch} patché(s), ${nbSkipQty0} ignorés (qty=0)`)
process.exit(0)
