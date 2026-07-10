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

const chSnap = await db.collection('chineuse').get()
const smallBatchTrig = new Set()
chSnap.docs.forEach(d => {
  if (d.data().stockType === 'smallBatch') smallBatchTrig.add((d.data().trigramme || '').toUpperCase())
})
console.log(`smallBatch exclues : ${[...smallBatchTrig].join(', ')}`)

const targets = []
for (const statut of ['retour', 'supprime']) {
  const snap = await db.collection('produits').where('statut', '==', statut).get()
  snap.docs.forEach(d => {
    const p = d.data()
    const trig = (p.trigramme || '').toUpperCase()
    if (smallBatchTrig.has(trig)) return
    const variationId = p.variationId || p.catalogObjectId
    const itemId = p.itemId
    if (!variationId && !itemId) return
    targets.push({ id: d.id, sku: p.sku || d.id, statut, variationId, itemId })
  })
}
console.log(`Total (retour + supprime) : ${targets.length}`)

let deleted = 0, gone = 0, failed = 0, i = 0
for (const t of targets) {
  let varDone = false, itemDone = false
  if (t.variationId) {
    try {
      await client.catalogApi.deleteCatalogObject(t.variationId)
      varDone = true; deleted++
    } catch (err) {
      if (err?.statusCode === 404) { varDone = true; gone++ }
      else if (err?.statusCode === 429) {
        await new Promise(r => setTimeout(r, 2000))
        try { await client.catalogApi.deleteCatalogObject(t.variationId); varDone = true; deleted++ }
        catch { failed++ }
      } else failed++
    }
  }
  if (t.itemId) {
    try { await client.catalogApi.deleteCatalogObject(t.itemId); itemDone = true }
    catch (err) {
      if (err?.statusCode === 404) itemDone = true
      else if (err?.statusCode === 429) {
        await new Promise(r => setTimeout(r, 2000))
        try { await client.catalogApi.deleteCatalogObject(t.itemId); itemDone = true } catch { /* skip */ }
      }
    }
  }
  const cleanup = {}
  if (varDone) { cleanup.variationId = FieldValue.delete(); cleanup.catalogObjectId = FieldValue.delete() }
  if (itemDone) cleanup.itemId = FieldValue.delete()
  if (Object.keys(cleanup).length > 0) await db.collection('produits').doc(t.id).update(cleanup).catch(() => {})
  i++
  if (i % 50 === 0) console.log(`  ... ${i}/${targets.length} (${deleted} del, ${gone} 404, ${failed} err)`)
  await new Promise(r => setTimeout(r, 80))
}
console.log(`\n=== TOTAL === ${deleted} supprimés | ${gone} déjà absents | ${failed} échecs`)
process.exit(0)
