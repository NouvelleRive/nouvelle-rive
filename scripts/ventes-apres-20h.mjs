// Liste les ventes après 20h pour avril 2026
import 'dotenv/config'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()

const ventesSnap = await db.collection('ventes').get()
const ventes = ventesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  .filter(v => {
    if (!v.dateVente) return false
    const d = v.dateVente.toDate ? v.dateVente.toDate() : new Date(v.dateVente)
    return d.getMonth() + 1 === 4 && d.getFullYear() === 2026 && d.getHours() >= 20
  })
  .sort((a, b) => {
    const da = a.dateVente.toDate ? a.dateVente.toDate() : new Date(a.dateVente)
    const dbb = b.dateVente.toDate ? b.dateVente.toDate() : new Date(b.dateVente)
    return da - dbb
  })

console.log(`\n📋 ${ventes.length} ventes après 20h en avril 2026\n`)
const parJour = new Map()
for (const v of ventes) {
  const d = v.dateVente.toDate ? v.dateVente.toDate() : new Date(v.dateVente)
  const j = String(d.getDate()).padStart(2, '0')
  const heure = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const sku = (v.sku || v.nomSquare || '').padEnd(20).slice(0, 20)
  console.log(`  ${j}/04  ${heure}  ${sku} ${(v.prixVenteReel || 0).toFixed(2).padStart(8)} €`)
  parJour.set(j, (parJour.get(j) || 0) + (v.prixVenteReel || 0))
}

console.log('\n📊 Total après 20h par jour :')
for (const [j, s] of [...parJour].sort()) console.log(`  ${j}/04  ${s.toFixed(2).padStart(10)} €`)

const total = ventes.reduce((s, v) => s + (v.prixVenteReel || 0), 0)
console.log(`\n💰 TOTAL ventes après 20h : ${total.toFixed(2)} €`)
process.exit(0)
