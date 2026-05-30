// Vérifie combien de pièces vendues sur les 7 derniers jours sont éligibles
// au badge "Vendu" public (vendu=true + dateVente >= now-7j + champs OK).
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const septJoursMs = 7 * 24 * 60 * 60 * 1000
const seuil = Timestamp.fromMillis(Date.now() - septJoursMs)

console.log('Seuil dateVente :', seuil.toDate().toISOString())

// 1) Toutes les vendues (peu importe la date) pour voir le shape
const snapAll = await db.collection('produits').where('vendu', '==', true).limit(2000).get()
console.log(`Total produits vendu=true (max 2000) : ${snapAll.size}`)

let avecDate = 0
let recents = 0
const exemples = []
for (const doc of snapAll.docs) {
  const p = doc.data()
  if (p.dateVente) {
    avecDate++
    const dv = p.dateVente.toDate ? p.dateVente.toDate() : new Date(p.dateVente)
    if (Date.now() - dv.getTime() <= septJoursMs) {
      recents++
      if (exemples.length < 10) {
        exemples.push({
          id: doc.id,
          sku: p.sku,
          nom: p.nom,
          dateVente: dv.toISOString(),
          imageUrls: p.imageUrls?.length || 0,
          statut: p.statut,
          hidden: p.hidden,
        })
      }
    }
  }
}

console.log(`Avec dateVente renseignée : ${avecDate}`)
console.log(`Vendues dans les 7 derniers jours : ${recents}`)
console.log('Exemples :', JSON.stringify(exemples, null, 2))

// 2) Test direct de la requête utilisée par siteConfig.ts
console.log('\n--- Requête comme siteConfig.ts ---')
try {
  const qVendues = db.collection('produits')
    .where('vendu', '==', true)
    .where('dateVente', '>=', seuil)
    .orderBy('dateVente', 'desc')
    .limit(500)
  const snap = await qVendues.get()
  console.log(`Requête OK, ${snap.size} résultats.`)
} catch (err) {
  console.log('Requête a échoué :', err.message)
}

process.exit(0)
