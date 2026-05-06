// Applique la correction des dates : ventes + produits liés
// Usage: node --env-file=.env.local scripts/apply-fix-dates.mjs --apply
import 'dotenv/config'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { Client, Environment } from 'square'

const apply = process.argv.includes('--apply')

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()
const square = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
})

const SEUIL_HEURES = 1

const ventesSnap = await db.collection('ventes').get()
const ventes = ventesSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
const ventesSquare = ventes.filter(v => v.orderId && (v.source === 'square' || v.source === 'boutique'))

const orderIds = [...new Set(ventesSquare.map(v => v.orderId))]
console.log(`🔍 ${orderIds.length} orderIds à interroger côté Square...`)

const closedAtByOrder = new Map()
let i = 0
for (const orderId of orderIds) {
  i++
  if (i % 100 === 0) console.log(`  ${i}/${orderIds.length}`)
  try {
    const { result } = await square.ordersApi.retrieveOrder(orderId)
    const o = result.order
    if (o?.closedAt) closedAtByOrder.set(orderId, new Date(o.closedAt))
    else if (o?.createdAt) closedAtByOrder.set(orderId, new Date(o.createdAt))
  } catch {}
}

const aCorriger = []
for (const v of ventesSquare) {
  const trueDate = closedAtByOrder.get(v.orderId)
  if (!trueDate) continue
  const currentDate = v.dateVente.toDate ? v.dateVente.toDate() : new Date(v.dateVente)
  const diffHours = Math.abs(trueDate.getTime() - currentDate.getTime()) / 3600000
  if (diffHours < SEUIL_HEURES) continue
  aCorriger.push({ vente: v, trueDate })
}

console.log(`\n📅 ${aCorriger.length} ventes à corriger`)

if (!apply) {
  console.log('\n⚠️  Mode DRYRUN — relance avec --apply pour vraiment écrire')
  process.exit(0)
}

console.log('\n✏️  Application des corrections...')

const BATCH_SIZE = 400
let updated = 0
let produitsUpdated = 0

// Charger chineuses smallBatch pour le produit (différencier dateVente vs dateRupture)
const chSnap = await db.collection('chineuse').get()
const triSmallBatch = new Set()
for (const d of chSnap.docs) {
  const data = d.data()
  if (data.stockType === 'smallBatch' && data.trigramme) triSmallBatch.add(data.trigramme.toUpperCase())
}
const isSmallBatchProduit = (p) => {
  const tri = (p.trigramme || (p.sku || '').match(/^[A-Za-z]+/)?.[0] || '').toUpperCase()
  if (triSmallBatch.has(tri)) return true
  if (p.sku) {
    const u = p.sku.toUpperCase()
    for (const t of triSmallBatch) if (u.startsWith(t)) return true
  }
  return false
}

for (let idx = 0; idx < aCorriger.length; idx += BATCH_SIZE) {
  const batch = db.batch()
  const slice = aCorriger.slice(idx, idx + BATCH_SIZE)
  const produitsToFix = []

  for (const { vente, trueDate } of slice) {
    const ts = Timestamp.fromDate(trueDate)
    batch.update(vente.ref, { dateVente: ts, createdAt: ts })
    updated++
    if (vente.produitId) produitsToFix.push({ produitId: vente.produitId, ts })
  }

  await batch.commit()

  // Maj produits dans une 2e passe (avec lecture pour décider dateVente vs dateRupture)
  for (const { produitId, ts } of produitsToFix) {
    try {
      const pRef = db.collection('produits').doc(produitId)
      const pSnap = await pRef.get()
      if (!pSnap.exists) continue
      const p = pSnap.data()
      const update = {}
      if (isSmallBatchProduit(p) && p.dateRupture) update.dateRupture = ts
      if (p.dateVente) update.dateVente = ts
      if (Object.keys(update).length) {
        await pRef.update(update)
        produitsUpdated++
      }
    } catch {}
  }

  console.log(`  ${Math.min(idx + BATCH_SIZE, aCorriger.length)}/${aCorriger.length}`)
}

console.log(`\n✅ ${updated} ventes mises à jour, ${produitsUpdated} produits liés mis à jour`)
process.exit(0)
