// Dryrun cleanup-doublons - aucune écriture, juste un rapport
import 'dotenv/config'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!projectId || !clientEmail || !privateKey) {
  console.error('Variables Firebase manquantes dans .env.local')
  process.exit(1)
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}
const db = getFirestore()

const moisArg = process.argv[2] || null // format "5-2026"

const ventesSnap = await db.collection('ventes').get()
let ventes = ventesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

if (moisArg) {
  const [m, y] = moisArg.split('-').map(Number)
  ventes = ventes.filter(v => {
    if (!v.dateVente) return false
    const d = v.dateVente.toDate ? v.dateVente.toDate() : new Date(v.dateVente)
    return d.getMonth() + 1 === m && d.getFullYear() === y
  })
}

const chineusesSnap = await db.collection('chineuse').get()
const trigrammesSmallBatch = new Set()
for (const doc of chineusesSnap.docs) {
  const data = doc.data()
  if (data.stockType === 'smallBatch' && data.trigramme) {
    trigrammesSmallBatch.add(data.trigramme.toUpperCase())
  }
}
const isSmallBatchVente = (v) => {
  if (v.trigramme && trigrammesSmallBatch.has(v.trigramme.toUpperCase())) return true
  if (v.sku) {
    const skuUpper = v.sku.toUpperCase()
    for (const tri of trigrammesSmallBatch) {
      if (skuUpper.startsWith(tri)) return true
    }
  }
  return false
}

console.log(`\n📋 ${ventes.length} ventes${moisArg ? ` pour ${moisArg}` : ' (toutes)'}`)
console.log(`🧵 ${trigrammesSmallBatch.size} chineuses smallBatch exclues : ${[...trigrammesSmallBatch].join(', ')}\n`)

const dejaSupprimes = new Set()
const details = []

// ÉTAPE 0 : orderId + lineItemUid (technique, applicable à tous)
const parOrderLineItem = new Map()
for (const v of ventes) {
  if (!v.orderId || !v.lineItemUid) continue
  const key = `${v.orderId}::${v.lineItemUid}`
  if (!parOrderLineItem.has(key)) parOrderLineItem.set(key, [])
  parOrderLineItem.get(key).push(v)
}
for (const [key, vMemes] of parOrderLineItem) {
  if (vMemes.length <= 1) continue
  vMemes.sort((a, b) => {
    if (a.attribue && !b.attribue) return -1
    if (!a.attribue && b.attribue) return 1
    return (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)
  })
  const aGarder = vMemes[0]
  for (let i = 1; i < vMemes.length; i++) {
    const dbl = vMemes[i]
    if (dejaSupprimes.has(dbl.id)) continue
    dejaSupprimes.add(dbl.id)
    details.push({
      raison: `Même ligne Square (${key})`,
      garde: `${aGarder.sku || aGarder.nom} (${aGarder.id})`,
      supprime: `${dbl.sku || dbl.nom} (${dbl.id})`,
      prix: dbl.prixVenteReel,
    })
  }
}

// ÉTAPE 1 : même SKU + même prix + même jour (exclut smallBatch)
const groupes = new Map()
for (const v of ventes) {
  if (!v.prixVenteReel || !v.dateVente) continue
  const d = v.dateVente.toDate ? v.dateVente.toDate() : new Date(v.dateVente)
  const dateJour = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  const key = `${v.prixVenteReel}-${dateJour}`
  if (!groupes.has(key)) groupes.set(key, [])
  groupes.get(key).push(v)
}

for (const [, groupe] of groupes) {
  if (groupe.length <= 1) continue
  const parSku = new Map()
  for (const v of groupe) {
    if (!v.sku) continue
    if (isSmallBatchVente(v)) continue
    const sku = v.sku.toLowerCase().trim()
    if (!parSku.has(sku)) parSku.set(sku, [])
    parSku.get(sku).push(v)
  }
  for (const [sku, vMemes] of parSku) {
    if (vMemes.length <= 1) continue
    const aGarder = vMemes[0]
    for (let i = 1; i < vMemes.length; i++) {
      const dbl = vMemes[i]
      if (dejaSupprimes.has(dbl.id)) continue
      dejaSupprimes.add(dbl.id)
      const d = dbl.dateVente.toDate ? dbl.dateVente.toDate() : new Date(dbl.dateVente)
      details.push({
        raison: `Même SKU+jour: ${sku.toUpperCase()}`,
        garde: `${aGarder.sku} (${aGarder.id})`,
        supprime: `${dbl.sku} (${dbl.id}) — ${d.toLocaleDateString('fr-FR')}`,
        prix: dbl.prixVenteReel,
      })
    }
  }
}

console.log(`🗑️ ${details.length} doublons identifiés\n`)
for (const d of details) {
  console.log(`  • ${d.raison}`)
  console.log(`    garde     : ${d.garde}`)
  console.log(`    supprime  : ${d.supprime}  (${d.prix}€)`)
}

if (details.length === 0) console.log('  (aucun doublon)')
console.log('')
process.exit(0)
