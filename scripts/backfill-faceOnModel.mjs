// Backfill : pour les produits qui ont une URL "on-model_*" dans imageUrls
// mais pas de photos.faceOnModel, copier l'URL dans photos.faceOnModel
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const dryRun = process.argv.includes('--apply') ? false : true
console.log(dryRun ? '🟡 DRY RUN' : '🟢 APPLY')

const snap = await db.collection('produits').get()
let nbPatch = 0
for (const d of snap.docs) {
  const p = d.data()
  if (p.photos?.faceOnModel) continue // déjà OK
  if (!Array.isArray(p.imageUrls)) continue
  const onModel = p.imageUrls.find((u) => typeof u === 'string' && /\/on-model[\/_-]/i.test(u))
  if (!onModel) continue

  nbPatch++
  console.log(`  ${p.sku || d.id}: ${onModel}`)
  if (!dryRun) await d.ref.update({ 'photos.faceOnModel': onModel })
}
console.log(`\n${nbPatch} produit(s) à patcher`)
process.exit(0)
