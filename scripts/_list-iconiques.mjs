import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, 'firebase-service-account.json'), 'utf8')
)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const snap = await db.collection('iconiques').get()
const rows = []
snap.forEach(d => {
  const data = d.data()
  rows.push({
    nom: data.nom || '(sans nom)',
    type: data.type || 'vintage',
    marque: data.marque || '',
    trigrammes: (data.chineuseTrigrammes || []).join(',') || '(vide)',
    cats: (data.categoriesIn || []).join(',') || '(vide)',
    affiche: data.displayOnWebsite !== false,
    ordre: data.ordre ?? 0,
  })
})
rows.sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
console.log(`\n=== ${rows.length} ICONIQUES EN BASE ===\n`)
for (const r of rows) {
  console.log(`[${r.type}] ${r.nom}`)
  console.log(`   marque: "${r.marque}"`)
  console.log(`   trigrammes: ${r.trigrammes}`)
  console.log(`   categoriesIn: ${r.cats}`)
  console.log(`   affiché: ${r.affiche}`)
  console.log('')
}
process.exit(0)
