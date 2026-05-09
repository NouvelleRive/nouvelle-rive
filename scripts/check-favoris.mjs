// Inspecte la collection favoris pour comprendre pourquoi /coups-de-coeur est vide
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const favSnap = await db.collection('favoris').get()
console.log(`Total docs dans favoris : ${favSnap.size}`)

if (favSnap.size === 0) {
  console.log('⛔ La collection favoris est VIDE → c\'est pour ça que /coups-de-coeur est vide')
  console.log('   Vérification : peut-être que les likes sont stockés ailleurs ?')
  // Chercher d'autres collections plausibles
  const collections = await db.listCollections()
  console.log('\nCollections existantes :')
  collections.forEach(c => console.log(`  - ${c.id}`))
  process.exit(0)
}

// Sinon : grouper par productId
const counts = new Map()
favSnap.docs.forEach(d => {
  const pid = d.data().productId
  if (!pid) return
  counts.set(pid, (counts.get(pid) || 0) + 1)
})
console.log(`Produits likés : ${counts.size}`)
const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
console.log('Top 20 likés :')
for (const [pid, n] of ranked.slice(0, 20)) {
  const ds = await db.collection('produits').doc(pid).get()
  if (!ds.exists) { console.log(`  ${n}× ${pid} → ⛔ produit n'existe plus`); continue }
  const p = ds.data()
  const reasons = []
  const qty = p.quantite ?? 1
  if (qty <= 0) reasons.push('qty=0')
  if (p.vendu) reasons.push('vendu')
  if (p.statut === 'retour' || p.statut === 'supprime') reasons.push(`statut=${p.statut}`)
  if (p.recu === false) reasons.push('recu=false')
  if (p.hidden === true) reasons.push('hidden')
  if (p.forceDisplay === false) reasons.push('forceDisplay=false')
  if (!p.imageUrls?.length && !p.imageUrl) reasons.push('pas d\'image')
  const flag = reasons.length === 0 ? '✅ visible' : `⛔ ${reasons.join(', ')}`
  console.log(`  ${n}× ${p.sku || pid} - ${flag}`)
}

// Aussi : afficher un exemple de doc favoris
console.log('\nExemple de doc favoris :')
console.log(JSON.stringify(favSnap.docs[0].data(), null, 2))
process.exit(0)
