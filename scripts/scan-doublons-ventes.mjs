import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync('./scripts/firebase-service-account.json', 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const SMALL_BATCH_TRIGRAMMES = new Set(['NR', 'TPV', 'PV', 'MV', 'DV'])

const snap = await db.collection('ventes').get()
console.log(`\n${snap.size} ventes au total\n`)

const byKey = new Map()
for (const d of snap.docs) {
  const v = d.data()
  const sku = (v.sku || '').toString().trim().toUpperCase()
  if (!sku) continue
  const tri = (v.trigramme || '').toString().trim().toUpperCase()
  if (SMALL_BATCH_TRIGRAMMES.has(tri)) continue
  const date = v.dateVente?.toDate?.() || v.createdAt?.toDate?.() || null
  if (!date) continue
  const jour = date.toISOString().slice(0, 10)
  const prix = Math.round(Number(v.prixVenteReel || 0))
  const key = `${sku}::${jour}::${prix}`
  if (!byKey.has(key)) byKey.set(key, [])
  byKey.get(key).push({ id: d.id, ...v, _date: date })
}

const dupGroups = [...byKey.entries()].filter(([, arr]) => arr.length > 1)
console.log(`\n=== ${dupGroups.length} groupe(s) de doublons potentiels (SKU + jour + prix, hors smallBatch) ===\n`)

for (const [key, arr] of dupGroups) {
  console.log('▶', key, `(${arr.length} docs)`)
  for (const v of arr) {
    console.log('   -', v.id)
    console.log('     orderId:', v.orderId, '| lineItemUid:', v.lineItemUid, '| source:', v.source)
    console.log('     date:', v._date.toISOString(), '| attribue:', v.attribue, '| nom:', v.nom)
  }
  console.log()
}

process.exit(0)
