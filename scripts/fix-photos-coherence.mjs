// Répare les incohérences entre imageUrls et photos.*
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const dryRun = process.argv.includes('--apply') ? false : true
console.log(dryRun ? '🟡 DRY RUN' : '🟢 APPLY')

const snap = await db.collection('produits').get()
let nb = 0

for (const d of snap.docs) {
  const p = d.data()
  const ph = p.photos || {}
  const updates = {}

  // 1) Si imageUrls contient une 2e on-model et photos.dosOnModel vide
  if (Array.isArray(p.imageUrls) && ph.faceOnModel && !ph.dosOnModel) {
    const second = p.imageUrls.find((u) => typeof u === 'string' && /\/on-model[\/_-]/i.test(u) && u !== ph.faceOnModel)
    if (second) updates['photos.dosOnModel'] = second
  }

  // 2) Si photos.faceOnModel défini mais absent de imageUrls → l'ajouter
  if (ph.faceOnModel && Array.isArray(p.imageUrls) && !p.imageUrls.includes(ph.faceOnModel)) {
    updates.imageUrls = [...p.imageUrls, ph.faceOnModel]
  }

  if (Object.keys(updates).length === 0) continue
  nb++
  console.log(`  ${p.sku || d.id}: ${Object.keys(updates).join(', ')}`)
  if (!dryRun) await d.ref.update(updates)
}
console.log(`\n${nb} produit(s) à patcher`)
process.exit(0)
