// Détail des ventes d'un jour précis
import 'dotenv/config'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()

const [j, m, y] = (process.argv[2] || '12-4-2026').split('-').map(Number)

const ventesSnap = await db.collection('ventes').get()
const ventes = ventesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  .filter(v => {
    if (!v.dateVente) return false
    const d = v.dateVente.toDate ? v.dateVente.toDate() : new Date(v.dateVente)
    return d.getDate() === j && d.getMonth() + 1 === m && d.getFullYear() === y
  })
  .sort((a, b) => {
    const da = a.dateVente.toDate ? a.dateVente.toDate() : new Date(a.dateVente)
    const dbb = b.dateVente.toDate ? b.dateVente.toDate() : new Date(b.dateVente)
    return da - dbb
  })

console.log(`\n📋 ${ventes.length} ventes le ${j}/${m}/${y}\n`)
let total = 0
for (const v of ventes) {
  const d = v.dateVente.toDate ? v.dateVente.toDate() : new Date(v.dateVente)
  const heure = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const sku = (v.sku || v.nomSquare || '').padEnd(28).slice(0, 28)
  const prix = (v.prixVenteReel || 0).toFixed(2).padStart(8)
  total += v.prixVenteReel || 0
  console.log(`  ${heure}  ${sku} ${prix}€   ${v.id}  [order:${(v.orderId || '-').slice(0, 16)}]`)
}
console.log(`\n💰 TOTAL : ${total.toFixed(2)} €`)
process.exit(0)
