import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
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

const TRIGRAMME = (process.argv[2] || '').toUpperCase()
if (!TRIGRAMME) { console.error('Usage: node _cleanup-vendus-trigramme.mjs <TRIGRAMME>'); process.exit(1) }

// Safety : bloquer si smallBatch
const chSnap = await db.collection('chineuse').where('trigramme', '==', TRIGRAMME).get()
if (!chSnap.empty && chSnap.docs[0].data().stockType === 'smallBatch') {
  console.error(`BLOQUÉ : ${TRIGRAMME} est smallBatch, on ne supprime pas ses vendus.`)
  process.exit(1)
}

const snap = await db.collection('produits').where('vendu', '==', true).get()
const targets = []
snap.docs.forEach(d => {
  const p = d.data()
  if ((p.trigramme || '').toUpperCase() !== TRIGRAMME) return
  const variationId = p.variationId || p.catalogObjectId
  const itemId = p.itemId
  if (!variationId && !itemId) return
  targets.push({ id: d.id, sku: p.sku || d.id, variationId, itemId })
})
console.log(`${TRIGRAMME} : ${targets.length} pièces à supprimer de Square`)

let deleted = 0, gone = 0, failed = 0
for (const t of targets) {
  let varDone = false, itemDone = false
  if (t.variationId) {
    try {
      await client.catalogApi.deleteCatalogObject(t.variationId)
      varDone = true
      deleted++
    } catch (err) {
      if (err?.statusCode === 404) { varDone = true; gone++ }
      else { console.warn(`✗ ${t.sku} var: ${err?.message}`); failed++ }
    }
  }
  if (t.itemId) {
    try {
      await client.catalogApi.deleteCatalogObject(t.itemId)
      itemDone = true
    } catch (err) {
      if (err?.statusCode === 404) itemDone = true
      else console.warn(`✗ ${t.sku} item: ${err?.message}`)
    }
  }
  const cleanup = {}
  if (varDone) { cleanup.variationId = FieldValue.delete(); cleanup.catalogObjectId = FieldValue.delete() }
  if (itemDone) cleanup.itemId = FieldValue.delete()
  if (Object.keys(cleanup).length > 0) await db.collection('produits').doc(t.id).update(cleanup).catch(() => {})
  await new Promise(r => setTimeout(r, 60))
}
console.log(`\n${deleted} supprimés | ${gone} déjà absents | ${failed} échecs`)
process.exit(0)
