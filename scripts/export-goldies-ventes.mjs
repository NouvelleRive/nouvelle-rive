// Export les ventes des produits Goldies (NAN + LUC) pour avril + mai 2026
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const start = new Date('2026-04-01T00:00:00Z')
const end = new Date('2026-06-01T00:00:00Z') // exclusif

const all = await db.collection('ventes').get()
const goldies = all.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => {
  const trig = (v.trigramme || '').toUpperCase()
  const sku = (v.sku || '').toUpperCase()
  // Tout produit Goldies : trigramme NAN/LUC ou sku commençant par NAN/NG/LUC
  const isGoldies = trig === 'NAN' || trig === 'LUC' || /^(NAN|NG|LUC)/i.test(sku)
  if (!isGoldies) return false
  if (!v.dateVente) return false
  const date = v.dateVente.toDate ? v.dateVente.toDate() : new Date(v.dateVente)
  return date >= start && date < end
})

goldies.sort((a, b) => {
  const da = (a.dateVente.toDate ? a.dateVente.toDate() : new Date(a.dateVente)).getTime()
  const dbb = (b.dateVente.toDate ? b.dateVente.toDate() : new Date(b.dateVente)).getTime()
  return da - dbb
})

console.log(`${goldies.length} ventes Goldies entre ${start.toISOString().slice(0,10)} et ${end.toISOString().slice(0,10)}\n`)

const rows = ['Date,SKU,Nom,Prix vente,Prix initial,Source']
let totalCA = 0
for (const v of goldies) {
  const date = (v.dateVente.toDate ? v.dateVente.toDate() : new Date(v.dateVente)).toISOString().slice(0,10)
  const sku = v.sku || ''
  const nom = (v.nom || '').replace(/"/g, '""').replace(/^[A-Z]+\d+\s*-\s*/, '')
  const prix = v.prixVenteReel || v.prixInitial || 0
  const source = v.source || (v.squareOrderId ? 'Square' : v.ebayOrderId ? 'eBay' : '?')
  rows.push(`${date},${sku},"${nom}",${prix},${v.prixInitial || ''},${source}`)
  totalCA += prix
  console.log(`  [${date}] ${sku.padEnd(12)} ${prix}€  - ${nom.slice(0, 50)}`)
}

writeFileSync(`${process.env.HOME}/Desktop/goldies-ventes-avril-mai-2026.csv`, rows.join('\n'))
console.log(`\n💰 Total CA Goldies avril+mai : ${totalCA.toLocaleString('fr-FR')}€`)
console.log('📄 CSV : ~/Desktop/goldies-ventes-avril-mai-2026.csv')
process.exit(0)
