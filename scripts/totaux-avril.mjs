// Agrégat ventes par chineuse + par jour pour avril 2026
import 'dotenv/config'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()

const MOIS = 4
const ANNEE = 2026

// Charger chineuses pour mapper trigramme → nom
const chSnap = await db.collection('chineuse').get()
const nomByTri = new Map()
for (const d of chSnap.docs) {
  const data = d.data()
  if (data.trigramme) nomByTri.set(data.trigramme.toUpperCase(), data.nom || data.trigramme)
}

const ventesSnap = await db.collection('ventes').get()
const ventes = ventesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

const ventesMois = ventes.filter(v => {
  if (!v.dateVente) return false
  const d = v.dateVente.toDate ? v.dateVente.toDate() : new Date(v.dateVente)
  return d.getMonth() + 1 === MOIS && d.getFullYear() === ANNEE
})

console.log(`📋 ${ventesMois.length} ventes en avril 2026\n`)

// Total général
const total = ventesMois.reduce((s, v) => s + (v.prixVenteReel || 0), 0)
console.log(`💰 TOTAL : ${total.toFixed(2)} €\n`)

// Par jour
const parJour = new Map()
for (const v of ventesMois) {
  const d = v.dateVente.toDate ? v.dateVente.toDate() : new Date(v.dateVente)
  const k = String(d.getDate()).padStart(2, '0')
  parJour.set(k, (parJour.get(k) || 0) + (v.prixVenteReel || 0))
}
console.log('📅 Par jour :')
for (const [j, s] of [...parJour].sort()) console.log(`  ${j}/04  ${s.toFixed(2).padStart(10)} €`)

// Par chineuse (mapping trigramme → nom)
console.log('\n🧵 Par chineuse :')
const parChineuse = new Map()
const sansChineuse = []
for (const v of ventesMois) {
  let tri = (v.trigramme || '').toUpperCase()
  if (!tri && v.sku) {
    const skuU = v.sku.toUpperCase()
    // Pour MAKxxx la chineuse c'est MAK
    for (const knownTri of nomByTri.keys()) {
      if (skuU.startsWith(knownTri)) { tri = knownTri; break }
    }
    if (!tri) tri = (v.sku || '').match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || ''
  }
  if (!tri) { sansChineuse.push(v); continue }
  const cur = parChineuse.get(tri) || { total: 0, n: 0 }
  cur.total += v.prixVenteReel || 0
  cur.n++
  parChineuse.set(tri, cur)
}

const arr = [...parChineuse.entries()].map(([tri, x]) => ({
  tri,
  nom: nomByTri.get(tri) || `(? ${tri})`,
  total: x.total,
  n: x.n,
}))
arr.sort((a, b) => b.total - a.total)
for (const r of arr) {
  console.log(`  ${r.nom.padEnd(28)} ${r.tri.padEnd(8)} ${r.total.toFixed(2).padStart(10)} €  (${r.n} ventes)`)
}

if (sansChineuse.length > 0) {
  const totalSans = sansChineuse.reduce((s, v) => s + (v.prixVenteReel || 0), 0)
  console.log(`\n  ⚠️  ${sansChineuse.length} ventes sans chineuse identifiée (total ${totalSans.toFixed(2)} €)`)
  for (const v of sansChineuse.slice(0, 5)) {
    console.log(`     - ${v.sku || v.nomSquare || '(pas de SKU)'} ${v.prixVenteReel}€`)
  }
}

process.exit(0)
