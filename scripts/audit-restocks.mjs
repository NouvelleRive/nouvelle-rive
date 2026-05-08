// Audit complet : trouve tous les produits restockés récemment et vérifie leur visibilité
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

// 1. Tous les docs avec un SKU contenant un chiffre (= produits chineuses)
const allSnap = await db.collection('produits').get()
console.log(`Total produits dans la collection: ${allSnap.size}`)

// 2. Doublons par SKU
const bySku = new Map()
allSnap.docs.forEach(d => {
  const sku = (d.data().sku || '').toUpperCase()
  if (!sku) return
  if (!bySku.has(sku)) bySku.set(sku, [])
  bySku.get(sku).push({ id: d.id, ...d.data() })
})
const doublons = [...bySku.entries()].filter(([, arr]) => arr.length > 1)
if (doublons.length > 0) {
  console.log(`\n⚠️  DOUBLONS DE SKU (${doublons.length}) :`)
  doublons.slice(0, 20).forEach(([sku, arr]) => {
    console.log(`  ${sku} : ${arr.length} docs (ids: ${arr.map(p => p.id).join(', ')})`)
  })
}

// 3. Tous les produits avec une demande de restock encore en attente
const enAttente = allSnap.docs.filter(d => d.data().statutRestock === 'enAttente')
console.log(`\n📦 Restock en attente (non confirmé par vendeuse) : ${enAttente.length}`)
enAttente.slice(0, 20).forEach(d => {
  const p = d.data()
  const date = p.dateDemandeRestock?.toDate?.()?.toISOString?.()?.slice(0, 10) || '?'
  console.log(`  [${date}] ${p.sku} (+${p.quantiteRestock}) - ${p.nom?.slice(0, 50)}`)
})

// 4. Tous les produits avec dateRestock (= restock confirmé)
const confirmes = allSnap.docs
  .filter(d => d.data().dateRestock)
  .sort((a, b) => {
    const da = a.data().dateRestock?.toDate?.()?.getTime?.() || 0
    const db_ = b.data().dateRestock?.toDate?.()?.getTime?.() || 0
    return db_ - da
  })
console.log(`\n✅ Restock confirmés (avec dateRestock) : ${confirmes.length} - 20 plus récents :`)

const now = Date.now()
let nbVisibles = 0, nbBloques = 0
const raisonsBlocage = {}

confirmes.slice(0, 30).forEach(d => {
  const p = d.data()
  const date = p.dateRestock?.toDate?.()?.toISOString?.()?.slice(0, 10) || '?'
  const reasons = []
  const qty = p.quantite ?? 1
  if (qty <= 0) reasons.push(`qty=${qty}`)
  if (p.vendu === true) reasons.push('vendu=true')
  if (p.statut === 'retour' || p.statut === 'supprime') reasons.push(`statut=${p.statut}`)
  if (p.recu === false) reasons.push('recu=false')
  if (p.hidden === true) reasons.push('hidden=true')
  if (p.forceDisplay === false) reasons.push('forceDisplay=false')
  if (!p.imageUrls?.length && !p.imageUrl) reasons.push('pas d\'image')
  if (!p.createdAt) reasons.push('pas de createdAt (exclu par orderBy)')
  if (p.createdAt) {
    const cd = p.createdAt.toDate?.() || new Date(p.createdAt)
    const days = (now - cd.getTime()) / 86400000
    if (days > 15) reasons.push(`age=${days.toFixed(0)}j > joursRecents=15`)
  }
  const visible = reasons.length === 0
  if (visible) nbVisibles++; else nbBloques++
  reasons.forEach(r => { raisonsBlocage[r] = (raisonsBlocage[r] || 0) + 1 })
  const flag = visible ? '✅' : `❌ ${reasons.join(', ')}`
  console.log(`  [${date}] ${p.sku} qty=${qty} - ${flag}`)
})
console.log(`\nRésumé restocks récents : ${nbVisibles} visibles, ${nbBloques} bloqués`)
if (Object.keys(raisonsBlocage).length > 0) {
  console.log('Top raisons de blocage :')
  Object.entries(raisonsBlocage).sort((a,b) => b[1]-a[1]).forEach(([r,n]) => console.log(`  - ${r} : ${n}`))
}
process.exit(0)
