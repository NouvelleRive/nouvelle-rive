// Restaure createdAt = dateRestock pour les pièces que j'avais patchées à tort
// + supprime le filtre joursRecents sur siteConfig/new-in
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const dryRun = process.argv.includes('--apply') ? false : true
console.log(dryRun ? '🟡 DRY RUN (ajouter --apply)' : '🟢 APPLY')

// 1. Restaurer createdAt = dateRestock (approximation au plus proche de l'original)
const snap = await db.collection('produits').where('dateRestock', '!=', null).get()
let nb = 0, skip = 0
for (const d of snap.docs) {
  const p = d.data()
  if (!p.dateRestock) { skip++; continue }
  // Sécurité : ne patcher que ceux dont createdAt est > dateRestock (= bug introduit ce matin)
  const createdMs = p.createdAt?.toMillis?.() || 0
  const restockMs = p.dateRestock.toMillis()
  if (createdMs <= restockMs) { skip++; continue }
  nb++
  console.log(`  ${p.sku}: createdAt ${new Date(createdMs).toISOString().slice(0,16)} → ${new Date(restockMs).toISOString().slice(0,16)}`)
  if (!dryRun) await d.ref.update({ createdAt: p.dateRestock })
}
console.log(`\n${nb} produit(s) restaurés, ${skip} ignorés (déjà cohérents)`)

// 2. Supprimer joursRecents de siteConfig/new-in
console.log('\n--- siteConfig/new-in ---')
const cfgRef = db.collection('siteConfig').doc('new-in')
const cfgSnap = await cfgRef.get()
if (cfgSnap.exists && cfgSnap.data().joursRecents != null) {
  console.log(`  joursRecents actuel : ${cfgSnap.data().joursRecents} → SUPPRIMER`)
  if (!dryRun) await cfgRef.update({ joursRecents: FieldValue.delete() })
} else {
  console.log('  joursRecents déjà absent')
}
process.exit(0)
