import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const ref = db.collection('iconiques').doc('collier-montre-ines-pineau')
await ref.update({
  categorieRecherche: 'montre',                     // matche les pièces dont le nom/cat contient "montre"
  categoriesIn: [],                                  // pas de filtre par catégorie
  categoriesOrder: ['collier', 'bague', 'broche'],  // tri d'affichage : colliers d'abord
})

const after = (await ref.get()).data()
console.log({
  categorieRecherche: after.categorieRecherche,
  categoriesIn: after.categoriesIn,
  categoriesOrder: after.categoriesOrder,
  chineuseTrigrammes: after.chineuseTrigrammes,
})
process.exit(0)
