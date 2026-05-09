// Reproduit la requête exacte de useFilteredProducts('new-in') et vérifie si un SKU est dedans
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const sku = (process.argv[2] || 'AGE145').toUpperCase()
const pageId = process.argv[3] || 'new-in'

// Même requête que getFilteredProducts dans siteConfig.ts:120-125
const snap = await db.collection('produits')
  .where('vendu', '==', false)
  .orderBy('createdAt', 'desc')
  .limit(100)
  .get()

console.log(`Total non-vendus retournés (page 1, limit 100) : ${snap.size}`)

// Charger config page
const cfgSnap = await db.collection('siteConfig').doc(pageId).get()
const cfg = cfgSnap.exists ? cfgSnap.data() : { regles: [] }

let position = -1
let allProduits = []
snap.docs.forEach((d, i) => {
  const p = { id: d.id, ...d.data() }
  allProduits.push(p)
  if (p.sku?.toUpperCase() === sku) position = i + 1
})

if (position === -1) {
  console.log(`\n⛔ ${sku} N'EST PAS dans les 100 premiers résultats Firestore (pas dans la 1ère page)`)
  console.log('   → Soit le doc n\'a pas vendu=false, soit il n\'a pas createdAt, soit il est plus loin dans le tri')

  // Verifier ce qu'a le doc
  const dsnap = await db.collection('produits').where('sku', '==', sku).limit(1).get()
  if (!dsnap.empty) {
    const p = dsnap.docs[0].data()
    console.log(`   - vendu (type) : ${p.vendu} (${typeof p.vendu})`)
    console.log(`   - createdAt   : ${p.createdAt?.toDate?.()?.toISOString?.() || p.createdAt} (${typeof p.createdAt})`)
  }
} else {
  console.log(`\n✅ ${sku} est en position ${position}/100 dans la requête Firestore`)
}

// Maintenant appliquer le filtre client (siteConfig.ts:141-167)
console.log('\n━━━ Application du filtre client (siteConfig.ts) ━━━')
const filtered = allProduits.filter(p => {
  const quantite = p.quantite ?? 1
  const reasons = []
  if (quantite <= 0) reasons.push('quantite<=0')
  if (p.statut === 'retour' || p.statut === 'supprime') reasons.push(`statut=${p.statut}`)
  if (p.recu === false) reasons.push('recu=false')
  if (p.hidden === true) reasons.push('hidden=true')
  if (p.forceDisplay === false) reasons.push('forceDisplay=false')
  const hasImage = (p.imageUrls && p.imageUrls.length > 0) || p.imageUrl
  if (!hasImage) reasons.push('pas d\'image')
  if (cfg.prixMin && p.prix < cfg.prixMin) reasons.push(`prix<${cfg.prixMin}`)
  if (cfg.prixMax && p.prix > cfg.prixMax) reasons.push(`prix>${cfg.prixMax}`)
  if (cfg.joursRecents && p.createdAt) {
    const cd = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt)
    const daysAgo = (Date.now() - cd.getTime()) / (1000 * 60 * 60 * 24)
    if (daysAgo > cfg.joursRecents) reasons.push(`age=${daysAgo.toFixed(1)}j>${cfg.joursRecents}`)
  }
  if (p.sku?.toUpperCase() === sku && reasons.length > 0) {
    console.log(`⛔ ${sku} EXCLU PAR LE FILTRE CLIENT : ${reasons.join(', ')}`)
  }
  return reasons.length === 0
})

const finalPos = filtered.findIndex(p => p.sku?.toUpperCase() === sku)
if (finalPos === -1) {
  console.log(`\n⛔ ${sku} N'apparaît PAS sur ${pageId}`)
} else {
  console.log(`\n✅ ${sku} apparaît en position ${finalPos + 1}/${filtered.length} sur la page ${pageId}`)
}

// Lister les 30 premiers de la page filtrée pour contexte
console.log('\nTop 30 visibles sur', pageId, ':')
filtered.slice(0, 30).forEach((p, i) => {
  const cd = p.createdAt?.toDate?.()?.toISOString?.()?.replace('T', ' ').slice(0,16) || '?'
  const dr = p.dateRestock?.toDate?.()?.toISOString?.()?.slice(0,10) || ''
  const tag = dr ? `[restock ${dr}]` : ''
  console.log(`  ${(i+1).toString().padStart(2)}. [${cd}] ${p.sku.padEnd(12)} - ${(p.nom || '').slice(0, 40)} ${tag}`)
})
process.exit(0)
