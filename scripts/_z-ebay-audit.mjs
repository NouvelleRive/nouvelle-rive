import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()
// tous les produits marqués vendu/rupture/quantite 0 qui portent encore un id eBay
const all = await db.collection('produits').get()
const fantomes = []
let onEbay = 0
all.forEach(d=>{
  const x=d.data()
  const hasEbay = x.ebayListingId || x.ebayOfferId
  if (!hasEbay) return
  onEbay++
  const plusEnBoutique = x.vendu===true || x.statut==='vendu' || x.statut==='outOfStock' || Number(x.quantite)===0 || x.statut==='supprime' || x.statut==='retire' || x.archive===true
  if (plusEnBoutique) fantomes.push({id:d.id, sku:x.sku, vendu:x.vendu, statut:x.statut, quantite:x.quantite, ebayListingId:x.ebayListingId, ebayOfferId:x.ebayOfferId})
})
console.log(`Produits avec ids eBay en base: ${onEbay}`)
console.log(`⚠️ FANTÔMES (sur eBay mais plus en boutique): ${fantomes.length}`)
fantomes.forEach(f=>console.log(`  ${f.sku} — statut=${f.statut} vendu=${f.vendu} q=${f.quantite} listing=${f.ebayListingId}`))
process.exit(0)
