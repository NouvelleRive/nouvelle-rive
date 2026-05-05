// Génère un CSV des ventes mal datées
import 'dotenv/config'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { Client, Environment } from 'square'
import fs from 'fs'

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
const ventes = ventesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
const ventesSquare = ventes.filter(v => v.orderId && (v.source === 'square' || v.source === 'boutique'))

const orderIds = [...new Set(ventesSquare.map(v => v.orderId))]
console.log(`🔍 ${orderIds.length} orderIds à interroger Square...`)

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

const ecarts = []
for (const v of ventesSquare) {
  const trueDate = closedAtByOrder.get(v.orderId)
  if (!trueDate) continue
  const currentDate = v.dateVente.toDate ? v.dateVente.toDate() : new Date(v.dateVente)
  const diffHours = Math.abs(trueDate.getTime() - currentDate.getTime()) / 3600000
  if (diffHours < SEUIL_HEURES) continue
  ecarts.push({
    sku: v.sku || v.nomSquare || '',
    prix: v.prixVenteReel || '',
    actuelle: currentDate,
    correcte: trueDate,
    ecartJours: (diffHours / 24).toFixed(2),
    venteId: v.id,
    orderId: v.orderId,
  })
}

ecarts.sort((a, b) => b.correcte - a.correcte)

const csv = [
  'SKU;Prix;DateActuelle;DateCorrecte;EcartJours;VenteId;OrderId',
  ...ecarts.map(e =>
    [e.sku, e.prix, e.actuelle.toISOString(), e.correcte.toISOString(), e.ecartJours, e.venteId, e.orderId].join(';')
  ),
].join('\n')

const outPath = '/Users/salomekassabi/Desktop/nouvelle-rive/ventes-mal-datees.csv'
fs.writeFileSync(outPath, csv)
console.log(`\n✅ ${ecarts.length} ventes mal datées → ${outPath}`)

// Résumé par mois
const parMois = new Map()
for (const e of ecarts) {
  const k = `${e.correcte.getFullYear()}-${String(e.correcte.getMonth() + 1).padStart(2, '0')}`
  parMois.set(k, (parMois.get(k) || 0) + 1)
}
console.log('\n📊 Répartition par mois (date correcte) :')
for (const [m, n] of [...parMois].sort()) console.log(`  ${m} : ${n}`)

const parChineuse = new Map()
for (const e of ecarts) {
  const tri = (e.sku || '').match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || '?'
  parChineuse.set(tri, (parChineuse.get(tri) || 0) + 1)
}
console.log('\n📊 Répartition par chineuse (trigramme SKU) :')
for (const [t, n] of [...parChineuse].sort((a, b) => b[1] - a[1])) console.log(`  ${t.padEnd(8)} ${n}`)

process.exit(0)
