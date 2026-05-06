// Calcule les commissions des vendeuses pour avril 2026 (post fix après-20h)
import 'dotenv/config'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()

// 1. Vendeuses
const vSnap = await db.collection('vendeuses').get()
const vendeuses = new Map() // id → name
for (const d of vSnap.docs) vendeuses.set(d.id, d.data().nom || d.data().prenom || d.id)

// 2. Planning avril 2026 — clé doc "planning/2026-04"
const pSnap = await db.collection('planning').doc('2026-04').get()
const planningSlots = pSnap.exists ? (pSnap.data().slots || {}) : {}
console.log(`📅 ${Object.keys(planningSlots).length} slots planning avril\n`)

// 3. Ventes avril
const ventesSnap = await db.collection('ventes').get()
const ventes = ventesSnap.docs.map(d => d.data())
  .filter(v => {
    if (!v.dateVente) return false
    const d = v.dateVente.toDate ? v.dateVente.toDate() : new Date(v.dateVente)
    return d.getMonth() + 1 === 4 && d.getFullYear() === 2026
  })

// 4. Calcul ca1220, ca1117, caJour par jour
const ca1220 = new Map()
const ca1117 = new Map()
const caJour = new Map()
for (const v of ventes) {
  const d = v.dateVente.toDate ? v.dateVente.toDate() : new Date(v.dateVente)
  const dateStr = `2026-04-${String(d.getDate()).padStart(2, '0')}`
  const h = d.getHours()
  const m = v.prixVenteReel || 0
  if (h >= 12 && h < 20) ca1220.set(dateStr, (ca1220.get(dateStr) || 0) + m)
  if (h >= 11 && h < 17) ca1117.set(dateStr, (ca1117.get(dateStr) || 0) + m)
  caJour.set(dateStr, (caJour.get(dateStr) || 0) + m) // toutes les ventes
}

// 5. Commissions par vendeuse
const commissions = new Map() // vendeuseId → total
const detailsParV = new Map() // vendeuseId → liste
const addBonus = (vid, ds, slot, ca) => {
  if ((caJour.get(ds) || 0) < 1000) return
  const bonus = ca * 0.01
  commissions.set(vid, (commissions.get(vid) || 0) + bonus)
  if (!detailsParV.has(vid)) detailsParV.set(vid, [])
  detailsParV.get(vid).push({ date: ds, slot, ca, bonus, caJour: caJour.get(ds) })
}

for (const [ds, ca] of ca1220) {
  const vid = planningSlots[`${ds}_12-20`]
  if (vid) addBonus(vid, ds, '12-20', ca)
}
for (const [ds, ca] of ca1117) {
  const vid = planningSlots[`${ds}_11-17`]
  if (vid) addBonus(vid, ds, '11-17', ca)
}

// 6. Affichage
console.log('💰 Commissions calculées avril 2026 :\n')
const totalRows = [...commissions.entries()].map(([vid, b]) => ({
  nom: vendeuses.get(vid) || vid,
  bonus: b,
  vid,
}))
totalRows.sort((a, b) => b.bonus - a.bonus)
for (const r of totalRows) {
  console.log(`  ${r.nom.padEnd(15)} ${r.bonus.toFixed(2).padStart(8)} €`)
}

console.log('\n📋 Détail par vendeuse :')
for (const r of totalRows) {
  console.log(`\n  ${r.nom} (total ${r.bonus.toFixed(2)}€) :`)
  const dets = detailsParV.get(r.vid) || []
  dets.sort((a, b) => a.date.localeCompare(b.date))
  for (const d of dets) {
    console.log(`    ${d.date}  slot ${d.slot}  ca=${d.ca.toFixed(2).padStart(8)}€  caJour=${d.caJour.toFixed(2)}  → ${d.bonus.toFixed(2)}€`)
  }
}

process.exit(0)
