// Beaucoup de descriptions ont déjà le format bilingue "FR\n\n🇬🇧 EN".
// On extrait l'EN existant + on garde uniquement le FR avant le drapeau.
// Pour ceux qui n'ont PAS de bloc 🇬🇧 → on flag pour traduction manuelle ensuite.
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, 'firebase-service-account.json'), 'utf8')
)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const FLAG_RE = /🇬🇧/

const snap = await db.collection('produits').where('vendu', '==', false).get()
const stillNeed = [] // produits sans 🇬🇧
let extracted = 0
let cleanedFr = 0
let alreadyEn = 0
let writeBatch = db.batch()
let pending = 0

const commit = async () => {
  if (pending === 0) return
  await writeBatch.commit()
  writeBatch = db.batch()
  pending = 0
}

for (const doc of snap.docs) {
  const d = doc.data()
  if ((d.quantite ?? 1) <= 0) continue
  if (d.statut === 'retour' || d.statut === 'supprime' || d.hidden === true) continue

  const description = (d.description || '').trim()
  const nom = (d.nom || '').trim()

  if (d.descriptionEn) { alreadyEn++; continue }

  if (description && FLAG_RE.test(description)) {
    // Split sur le drapeau (en gardant le contenu après)
    const parts = description.split(FLAG_RE)
    const frPart = parts[0].trim().replace(/\n+$/, '')
    const enPart = parts.slice(1).join('🇬🇧').trim()
    if (enPart) {
      const update = {
        description: frPart, // on garde la version FR seule (le drapeau dégage)
        descriptionEn: enPart,
      }
      writeBatch.update(db.collection('produits').doc(doc.id), update)
      pending++
      extracted++
      cleanedFr++
      if (pending >= 400) await commit()
      continue
    }
  }

  // Pas de bloc EN extractible
  if (nom || description) {
    stillNeed.push({ id: doc.id, nom, description, marque: d.marque || '' })
  }
}

await commit()

writeFileSync(
  resolve(__dirname, 'produits-need-translation.json'),
  JSON.stringify(stillNeed, null, 2)
)

let chars = 0
for (const p of stillNeed) chars += (p.nom?.length || 0) + (p.description?.length || 0)

console.log(`✓ Extrait depuis 🇬🇧 et écrit en Firestore : ${extracted} produits`)
console.log(`✓ Description FR nettoyée (drapeau retiré) : ${cleanedFr}`)
console.log(`= Déjà avec descriptionEn : ${alreadyEn}`)
console.log(`✗ Reste à traduire manuellement : ${stillNeed.length}`)
console.log(`  Caractères restants : ${chars.toLocaleString()}`)
console.log(`  Fichier : scripts/produits-need-translation.json`)
