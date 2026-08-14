import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()
const all = await db.collection('produits').get()
const fantomes = []; let onEbay = 0
all.forEach(d=>{
  const x=d.data()
  if (!(x.ebayListingId || x.ebayOfferId)) return
  onEbay++
  // règle EXACTE boutique (api/produits/all)
  const enBoutique = x.vendu!==true && (Number(x.quantite ?? 1)>0) && x.statut!=='supprime' && x.statut!=='retour' && !x.statutRecuperation
  if (!enBoutique) fantomes.push({docId:d.id, sku:x.sku, vendu:x.vendu, statut:x.statut, quantite:x.quantite, statutRecuperation:x.statutRecuperation||null, ebayListingId:x.ebayListingId})
})
console.log(`Annonces eBay en base: ${onEbay}`)
console.log(`⚠️ FANTÔMES (eBay mais PAS en boutique, règle exacte): ${fantomes.length}`)
fantomes.forEach(f=>console.log(`  ${f.sku} [${f.docId}] — vendu=${f.vendu} statut=${f.statut||'∅'} q=${f.quantite} recup=${f.statutRecuperation} listing=${f.ebayListingId}`))
process.exit(0)
