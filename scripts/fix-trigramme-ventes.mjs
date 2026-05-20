// Répare le champ `trigramme` des ventes où il a été stocké à partir du préfixe SKU
// (ex: MAKCHA / MAKDIO au lieu de MAK).
//
// Stratégie ciblée (rapide) :
//  1) Charger les trigrammes connus dans la collection `chineuse`
//  2) Récupérer toutes les ventes avec trigramme actuel "suspect" (préfixe d'un trigramme connu
//     mais qui n'EST PAS un trigramme connu) — typiquement MAKCHA, MAKDIO, MAKBAL, etc.
//  3) Réécrire le trigramme avec le bon (préfixe le plus long qui matche)

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-n')

// 1. Trigrammes connus (canoniques)
const chineusesSnap = await db.collection('chineuse').get()
const trigrammesSet = new Set(
  chineusesSnap.docs
    .map(d => (d.data().trigramme || '').toString().trim().toUpperCase())
    .filter(Boolean)
)
const trigrammesList = [...trigrammesSet].sort((a, b) => b.length - a.length)
console.log(`📋 ${trigrammesSet.size} trigrammes chineuses canoniques`)

function resolveBest(value) {
  if (!value) return null
  const up = value.toString().toUpperCase()
  return trigrammesList.find(t => up.startsWith(t)) || null
}

// 2. Lister les valeurs "suspectes" (présentes sur des ventes mais non-canoniques)
const distinctSnap = await db.collection('ventes').select('trigramme').get()
const distinctTris = new Set()
distinctSnap.forEach(d => {
  const t = (d.data().trigramme || '').toString().trim().toUpperCase()
  if (t) distinctTris.add(t)
})
const suspects = [...distinctTris].filter(t => !trigrammesSet.has(t) && resolveBest(t))
console.log(`🔎 ${distinctTris.size} trigrammes distincts en base, ${suspects.length} suspects à corriger :`, suspects.join(', '))

// 3. Pour chaque suspect, query ciblée et update batch
let totalUpdates = 0
for (const sus of suspects) {
  const bon = resolveBest(sus)
  if (!bon || bon === sus) continue
  const snap = await db.collection('ventes').where('trigramme', '==', sus).get()
  console.log(`\n🔧 ${sus} → ${bon} : ${snap.size} vente(s)`)
  if (DRY_RUN) {
    snap.docs.slice(0, 5).forEach(d => console.log(`   exemple: ${d.id} sku=${d.data().sku || d.data().skuSquare || '∅'}`))
    totalUpdates += snap.size
    continue
  }
  let batch = db.batch()
  let n = 0
  for (const d of snap.docs) {
    batch.update(d.ref, { trigramme: bon })
    n++
    if (n % 400 === 0) {
      await batch.commit()
      console.log(`   commit partiel ${n}/${snap.size}`)
      batch = db.batch()
    }
  }
  if (n % 400 !== 0) await batch.commit()
  console.log(`   ✅ ${n} ventes corrigées`)
  totalUpdates += n
}

console.log(`\n${DRY_RUN ? 'DRY RUN —' : '✅'} Total ${totalUpdates} ventes ${DRY_RUN ? 'à corriger' : 'corrigées'}`)
process.exit(0)
