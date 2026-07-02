import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sa = JSON.parse(readFileSync(resolve(__dirname, 'firebase-service-account.json'), 'utf8'))
initializeApp({ credential: cert(sa) })
const db = getFirestore()

const snap = await db.collection('produits').get()
let obj = 0, str = 0, empty = 0
const labels = new Map()
snap.forEach(d => {
  const c = d.data().categorie
  if (c === undefined || c === null || c === '') { empty++; return }
  if (typeof c === 'object') {
    obj++
    const l = (c.label || '').toLowerCase()
    labels.set(l, (labels.get(l) || 0) + 1)
  } else if (typeof c === 'string') {
    str++
    const l = c.toLowerCase()
    labels.set(l, (labels.get(l) || 0) + 1)
  }
})
console.log(`Total: ${snap.size}`)
console.log(`  categorie = objet: ${obj}`)
console.log(`  categorie = string: ${str}`)
console.log(`  categorie = vide: ${empty}`)
console.log('\n--- Labels distincts (top 30) ---')
const sorted = [...labels.entries()].sort((a, b) => b[1] - a[1])
sorted.slice(0, 30).forEach(([l, n]) => console.log(`  "${l}" (${n})`))
process.exit(0)
