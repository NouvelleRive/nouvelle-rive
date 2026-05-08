// Liste les chineuses publiques avec leurs textes FR (accroche + description)
// pour préparer les traductions EN.
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

const snap = await db
  .collection('chineuse')
  .where('displayOnWebsite', '==', true)
  .get()

const out = []
snap.forEach((doc) => {
  const d = doc.data()
  out.push({
    slug: d.slug || doc.id,
    id: doc.id,
    nom: d.nom || '',
    accroche: d.accroche || '',
    description: d.description || '',
    accrocheEn: d.accrocheEn || '',
    descriptionEn: d.descriptionEn || '',
  })
})

out.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''))

for (const c of out) {
  console.log('─'.repeat(80))
  console.log(`SLUG: ${c.slug}    NOM: ${c.nom}    (id=${c.id})`)
  console.log(`accroche FR     : ${c.accroche || '(vide)'}`)
  console.log(`accrocheEn      : ${c.accrocheEn || '(vide)'}`)
  console.log(`description FR  : ${c.description || '(vide)'}`)
  console.log(`descriptionEn   : ${c.descriptionEn || '(vide)'}`)
}
console.log('─'.repeat(80))
console.log(`TOTAL: ${out.length} chineuses publiques`)
