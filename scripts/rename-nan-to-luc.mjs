// Renomme NAN → LUC sur tous les produits + chineuse + iconiques
// Dry-run par défaut, ajouter --apply pour exécuter
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const dryRun = !process.argv.includes('--apply')
console.log(dryRun ? '🟡 DRY RUN (--apply pour exécuter)' : '🟢 APPLY')

// 1. Produits avec trigramme=NAN → trigramme=LUC, sku NANxxx → LUCxxx, nom mis à jour
const ps = await db.collection('produits').where('trigramme', '==', 'NAN').get()
console.log(`\n${ps.size} produits NAN à traiter`)
let nbSku = 0, nbTrigOnly = 0
for (const d of ps.docs) {
  const p = d.data()
  const oldSku = p.sku || ''
  const newSku = oldSku.startsWith('NAN') ? 'LUC' + oldSku.slice(3) : oldSku
  const newNom = (p.nom || '').replace(/^NAN(\d+)/, 'LUC$1').replace(/^NAN /, 'LUC ')
  const updates = { trigramme: 'LUC' }
  if (newSku !== oldSku) {
    updates.sku = newSku
    nbSku++
  } else {
    nbTrigOnly++
  }
  if (newNom !== p.nom) updates.nom = newNom
  if (!dryRun) await d.ref.update(updates)
  if (oldSku !== newSku) console.log(`  ${oldSku} → ${newSku}`)
}
console.log(`\n${nbSku} sku renommés, ${nbTrigOnly} sans changement de sku (juste trigramme)`)

// 2. Chineuse nan-goldies → trigramme LUC
if (!dryRun) await db.collection('chineuse').doc('nan-goldies').update({ trigramme: 'LUC' })
console.log('\n✅ chineuse/nan-goldies.trigramme = LUC')

// 3. Iconiques avec NAN dans chineuseTrigrammes
const ics = await db.collection('iconiques').where('chineuseTrigrammes', 'array-contains', 'NAN').get()
console.log(`\n${ics.size} iconiques avec NAN dans chineuseTrigrammes`)
for (const d of ics.docs) {
  const newTrigs = (d.data().chineuseTrigrammes || []).map(t => t === 'NAN' ? 'LUC' : t)
  if (!dryRun) await d.ref.update({ chineuseTrigrammes: newTrigs })
  console.log(`  ${d.id}: ${newTrigs.join(', ')}`)
}
process.exit(0)
