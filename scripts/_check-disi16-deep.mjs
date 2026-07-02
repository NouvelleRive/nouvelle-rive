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

console.log('=== Vente XQ4FyDixbeeRt7qmHENq ===')
const v = await db.collection('ventes').doc('XQ4FyDixbeeRt7qmHENq').get()
console.log(JSON.stringify(v.data(), null, 2))

console.log('\n=== Vérif Square catalog ===')
const { Client, Environment } = await import('square')
const sq = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT === 'sandbox' ? Environment.Sandbox : Environment.Production,
})
try {
  const { result } = await sq.catalogApi.retrieveCatalogObject('UEDV4LGVJBX2THQU26PWPOWZ')
  console.log('ITEM trouvé dans Square !')
  console.log('  name:', result.object?.itemData?.name)
  console.log('  isArchived:', result.object?.itemData?.isArchived)
  console.log('  presentAtAllLocations:', result.object?.presentAtAllLocations)
  console.log('  variations count:', result.object?.itemData?.variations?.length)
} catch (e) {
  console.log('Item PAS dans Square:', e?.message || e)
}
try {
  const { result } = await sq.catalogApi.retrieveCatalogObject('BDD25IMSBFOPV2PDWN3I7SNC')
  console.log('VARIATION trouvée dans Square !')
  console.log('  name:', result.object?.itemVariationData?.name)
} catch (e) {
  console.log('Variation PAS dans Square:', e?.message || e)
}
process.exit(0)
