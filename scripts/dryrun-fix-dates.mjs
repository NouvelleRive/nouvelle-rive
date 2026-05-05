// Dryrun fix-dates - lit closedAt depuis Square et compare au dateVente Firestore
import 'dotenv/config'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { Client, Environment } from 'square'

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!projectId || !clientEmail || !privateKey) {
  console.error('Variables Firebase manquantes')
  process.exit(1)
}
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()

const square = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
})

const moisArg = process.argv[2] || null
const SEUIL_HEURES = 1 // ne signaler que les écarts > 1h

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

// Filtrer aux ventes Square avec orderId
const ventesSquare = ventes.filter(v => v.orderId && (v.source === 'square' || v.source === 'boutique'))
console.log(`\n📋 ${ventesSquare.length} ventes Square${moisArg ? ` pour ${moisArg}` : ''} à vérifier\n`)

// Grouper par orderId pour éviter de retrieve N fois le même order
const orderIds = [...new Set(ventesSquare.map(v => v.orderId))]
console.log(`🔍 ${orderIds.length} orderIds uniques à interroger côté Square...\n`)

const closedAtByOrder = new Map()
let i = 0
for (const orderId of orderIds) {
  i++
  if (i % 50 === 0) console.log(`  ... ${i}/${orderIds.length}`)
  try {
    const { result } = await square.ordersApi.retrieveOrder(orderId)
    const o = result.order
    if (o?.closedAt) closedAtByOrder.set(orderId, new Date(o.closedAt))
    else if (o?.createdAt) closedAtByOrder.set(orderId, new Date(o.createdAt))
  } catch (e) {
    // Order introuvable côté Square (ex: ancienne archive) — on laisse tomber
  }
}

console.log(`\n✅ ${closedAtByOrder.size} dates Square récupérées\n`)

const ecarts = []
for (const v of ventesSquare) {
  const trueDate = closedAtByOrder.get(v.orderId)
  if (!trueDate) continue
  const currentDate = v.dateVente.toDate ? v.dateVente.toDate() : new Date(v.dateVente)
  const diffMs = Math.abs(trueDate.getTime() - currentDate.getTime())
  const diffHours = diffMs / (1000 * 60 * 60)
  if (diffHours < SEUIL_HEURES) continue
  ecarts.push({
    id: v.id,
    sku: v.sku || v.nomSquare,
    actuelle: currentDate,
    correcte: trueDate,
    ecartHeures: diffHours,
    prix: v.prixVenteReel,
  })
}

ecarts.sort((a, b) => b.ecartHeures - a.ecartHeures)

console.log(`📅 ${ecarts.length} ventes avec date incorrecte (écart > ${SEUIL_HEURES}h)\n`)

const fmt = (d) => d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
for (const e of ecarts) {
  const jours = (e.ecartHeures / 24).toFixed(1)
  console.log(`  • ${e.sku.padEnd(20)} ${e.prix}€`)
  console.log(`    actuelle  : ${fmt(e.actuelle)}`)
  console.log(`    correcte  : ${fmt(e.correcte)}  (écart ${jours}j)`)
  console.log(`    id        : ${e.id}`)
}

if (ecarts.length === 0) console.log('  (aucun écart)')
console.log('')
process.exit(0)
