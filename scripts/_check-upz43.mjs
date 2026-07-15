import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
import square from 'square'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })

const { Client, Environment } = square

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
const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN || '',
  environment: process.env.SQUARE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
})

console.log('=== FIRESTORE UPZ43 ===')
const snap = await db.collection('produits').where('sku', '==', 'UPZ43').get()
snap.docs.forEach(d => {
  const p = d.data()
  console.log(`id: ${d.id}`)
  console.log(`  nom: ${p.nom || p.Nom}`)
  console.log(`  vendu: ${p.vendu} | statut: ${p.statut} | quantite: ${p.quantite}`)
  console.log(`  recu: ${p.recu} | trigramme: ${p.trigramme}`)
  console.log(`  variationId: ${p.variationId || '(vide)'}`)
  console.log(`  itemId: ${p.itemId || '(vide)'}`)
  console.log(`  catalogObjectId: ${p.catalogObjectId || '(vide)'}`)
  console.log(`  dateVente: ${p.dateVente?.toDate?.() || '(?)'}`)
})

console.log('\n=== SQUARE (search UPZ43) ===')
try {
  const { result } = await client.catalogApi.searchCatalogObjects({
    objectTypes: ['ITEM'],
    query: { textQuery: { keywords: ['UPZ43'] } },
  })
  const items = result.objects || []
  console.log(`Trouvé sur Square : ${items.length}`)
  items.forEach(obj => {
    const variations = obj.itemData?.variations || []
    variations.forEach(v => {
      console.log(`  - itemId=${obj.id} varId=${v.id} sku=${v.itemVariationData?.sku}`)
    })
  })
} catch (err) {
  console.error('Search error:', err?.message)
}
process.exit(0)
