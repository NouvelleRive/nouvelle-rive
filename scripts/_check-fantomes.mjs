// Audit des pièces fantômes qui bloquent le trigger `remaining === 0`
// de Phase A (popup fin-de-restock).
// Read-only. Aucune modification.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}
const db = getFirestore()

const snap = await db.collection('produits').get()
console.log(`\n📦 Scan de ${snap.size} produits...`)

const now = Date.now()
const fantomes = []

for (const d of snap.docs) {
  const p = d.data()
  // Exclus : supprimé, vendu, retour (récupérée)
  if (p.statut === 'supprime' || p.statut === 'vendu' || p.statut === 'retour') continue
  if (p.vendu === true) continue
  // Fantôme si recu === false OU statutRestock === 'enAttente'
  const isFantome = p.recu === false || p.statutRestock === 'enAttente'
  if (!isFantome) continue
  const created = p.createdAt?.toDate?.()
  const ageJours = created ? Math.floor((now - created.getTime()) / (1000 * 60 * 60 * 24)) : null
  fantomes.push({
    id: d.id,
    sku: p.sku || '(sans sku)',
    tri: (p.trigramme || '?').toUpperCase(),
    source: p.source || '?',
    recu: p.recu,
    statutRestock: p.statutRestock,
    ageJours,
    createdAt: created,
  })
}

console.log(`\n👻 ${fantomes.length} pièce(s) fantôme(s) détectée(s)\n`)

if (fantomes.length === 0) {
  console.log('Aucun fantôme. Trigger fin-de-restock devrait fonctionner.')
  process.exit(0)
}

// Groupe par trigramme
const parTri = {}
for (const f of fantomes) {
  parTri[f.tri] ||= []
  parTri[f.tri].push(f)
}

const trisSorted = Object.keys(parTri).sort((a, b) => parTri[b].length - parTri[a].length)

console.log('Par trigramme (celles qui BLOQUENT le popup fin-de-restock) :\n')
for (const tri of trisSorted) {
  const list = parTri[tri]
  console.log(`  ${tri} — ${list.length} fantôme(s)`)
  // Trie par âge décroissant
  list.sort((a, b) => (b.ageJours ?? 0) - (a.ageJours ?? 0))
  for (const f of list.slice(0, 10)) {
    const flags = []
    if (f.recu === false) flags.push('recu=false')
    if (f.statutRestock === 'enAttente') flags.push('statutRestock=enAttente')
    const age = f.ageJours != null ? `${f.ageJours}j` : '?j'
    console.log(`    - ${f.sku.padEnd(10)} · ${age.padStart(5)} · ${f.source.padEnd(20)} · ${flags.join(' + ')}`)
  }
  if (list.length > 10) console.log(`    + ${list.length - 10} autres`)
}

// Stats globales
console.log(`\n📊 Résumé :`)
console.log(`   ${fantomes.filter(f => f.recu === false).length} avec recu === false`)
console.log(`   ${fantomes.filter(f => f.statutRestock === 'enAttente').length} avec statutRestock === 'enAttente'`)
console.log(`   ${trisSorted.length} trigrammes touchés\n`)

// Répartition par source
const parSource = {}
for (const f of fantomes) {
  parSource[f.source] = (parSource[f.source] || 0) + 1
}
console.log('Par source :')
for (const [src, n] of Object.entries(parSource).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${src.padEnd(20)} : ${n}`)
}

// Répartition par âge
const buckets = { '<7j': 0, '7-30j': 0, '30-90j': 0, '90-180j': 0, '>180j': 0, '?': 0 }
for (const f of fantomes) {
  if (f.ageJours == null) buckets['?']++
  else if (f.ageJours < 7) buckets['<7j']++
  else if (f.ageJours < 30) buckets['7-30j']++
  else if (f.ageJours < 90) buckets['30-90j']++
  else if (f.ageJours < 180) buckets['90-180j']++
  else buckets['>180j']++
}
console.log('\nPar âge (createdAt) :')
for (const [b, n] of Object.entries(buckets)) {
  if (n > 0) console.log(`   ${b.padEnd(10)} : ${n}`)
}

process.exit(0)
