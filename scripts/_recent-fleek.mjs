import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

// Tous les produits fleek, groupés par orderId
const snap = await db.collection('produits').where('source', '==', 'achat-fleek').get()
const byOrder = new Map()
snap.forEach(d => {
  const x = d.data()
  const oid = x.achatOrderId || 'unknown'
  const t = x.createdAt?.toDate?.() || new Date(0)
  if (!byOrder.has(oid)) byOrder.set(oid, { count: 0, min: t, max: t, titres: new Set() })
  const g = byOrder.get(oid)
  g.count++
  if (t < g.min) g.min = t
  if (t > g.max) g.max = t
  g.titres.add(x.achatTitreOriginal || '')
})
console.log('Order  Count  MinDate                 MaxDate                Titres')
for (const [oid, g] of byOrder) {
  console.log(`${oid.padEnd(8)} ${String(g.count).padEnd(6)} ${g.min.toISOString().slice(0,19)}   ${g.max.toISOString().slice(0,19)}   ${[...g.titres].join(' | ')}`)
}

// Les 20 plus récents produits NR (pour voir si un import Fleek de juillet est ailleurs)
const nrSnap = await db.collection('produits').where('trigramme', '==', 'NR').get()
const arr = []
nrSnap.forEach(d => arr.push({ id: d.id, sku: d.data().sku, source: d.data().source || '', titre: d.data().achatTitreOriginal || d.data().nom, createdAt: d.data().createdAt?.toDate?.() || new Date(0) }))
arr.sort((a,b) => b.createdAt - a.createdAt)
console.log('\n30 produits NR les plus récents :')
for (const r of arr.slice(0, 30)) {
  console.log(`  ${r.createdAt.toISOString().slice(0,19)} sku=${r.sku} src=${r.source} | ${r.titre}`)
}
process.exit(0)
