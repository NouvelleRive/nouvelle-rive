// État eBay des pièces CASTING ARCHIVES (trigramme CAS).
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

const snap = await db.collection('produits').where('trigramme', '==', 'CAS').get()
console.log(`${snap.size} produits CAS\n`)

const enLigne = []
const pas = []
for (const d of snap.docs) {
  const p = d.data()
  const ligne = `${p.sku} — ${p.marque}`
  if (p.ebayListingId) enLigne.push(ligne)
  else {
    const raisons = []
    if (p.vendu === true) raisons.push('vendu')
    if ((p.quantite ?? 1) <= 0) raisons.push('stock-0')
    if (p.recu === false) raisons.push('pas-reçu')
    if (p.statut === 'retour' || p.statut === 'supprime') raisons.push('statut-' + p.statut)
    const hasImage = (Array.isArray(p.imageUrls) && p.imageUrls.length > 0) || p.imageUrl
    if (!hasImage) raisons.push('no-image')
    pas.push(`${ligne}${raisons.length ? '  [' + raisons.join(', ') + ']' : ''}`)
  }
}

console.log(`✅ SUR EBAY (${enLigne.length}) :`)
enLigne.sort().forEach(l => console.log('  ' + l))
console.log(`\n❌ PAS SUR EBAY (${pas.length}) :`)
pas.sort().forEach(l => console.log('  ' + l))
