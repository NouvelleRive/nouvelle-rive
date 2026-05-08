// Liste les produits actifs (non vendus, visibles) avec leur nom + description.
// Sortie JSON pour batch translate ensuite.
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

const snap = await db.collection('produits').where('vendu', '==', false).get()
const out = []
let alreadyTranslated = 0
let totalChars = 0

snap.forEach((doc) => {
  const d = doc.data()
  if ((d.quantite ?? 1) <= 0) return
  if (d.statut === 'retour' || d.statut === 'supprime' || d.hidden === true) return
  const hasImage = (d.imageUrls && d.imageUrls.length > 0) || d.imageUrl
  if (!hasImage) return

  const nom = (d.nom || '').trim()
  const description = (d.description || '').trim()
  if (!nom && !description) return

  const hasEn = !!d.nomEn || !!d.descriptionEn
  if (hasEn) { alreadyTranslated++; return }

  out.push({
    id: doc.id,
    nom,
    description,
    marque: d.marque || '',
  })
  totalChars += nom.length + description.length
})

writeFileSync(
  resolve(__dirname, 'produits-to-translate.json'),
  JSON.stringify(out, null, 2)
)
console.log(`Produits à traduire : ${out.length}`)
console.log(`Déjà traduits : ${alreadyTranslated}`)
console.log(`Caractères total à traduire : ${totalChars.toLocaleString()}`)
console.log(`Fichier écrit : scripts/produits-to-translate.json`)
