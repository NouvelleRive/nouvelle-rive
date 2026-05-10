// Renomme NAN → LUC sur :
// - Firestore : sku, nom, trigramme des produits + chineuse/nan-goldies + iconiques
// - Square : update les items existants via catalogApi.upsertCatalogObject (item.name + variation.sku)
//
// Pas de suppression / recréation — garde l'historique des ventes Square.
// Skip gracefully si un item n'existe plus dans Square (404).
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { Client, Environment } from 'square'
import dotenv from 'dotenv'
dotenv.config({ path: new URL('../.env.local', import.meta.url).pathname })

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const dryRun = !process.argv.includes('--apply')
console.log(dryRun ? '🟡 DRY RUN (--apply pour exécuter)' : '🟢 APPLY')

const square = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
})

function renameSku(s) {
  if (!s) return s
  return s.startsWith('NAN') ? 'LUC' + s.slice(3) : s
}
function renameNom(s) {
  if (!s) return s
  return s.replace(/^NAN(\d+)/, 'LUC$1').replace(/^NAN /, 'LUC ').replace(/^NAN-/, 'LUC-')
}

const ps = await db.collection('produits').where('trigramme', '==', 'NAN').get()
console.log(`\n${ps.size} produits NAN`)

let nbDone = 0, nbSkipped = 0, nbSquare = 0
for (const d of ps.docs) {
  const p = d.data()
  const oldSku = p.sku || ''
  const newSku = renameSku(oldSku)
  const newNom = renameNom(p.nom || '')
  const updates = { trigramme: 'LUC' }
  if (newSku !== oldSku) updates.sku = newSku
  if (newNom !== p.nom) updates.nom = newNom

  // 1. Update Square si catalogObjectId présent
  if (p.catalogObjectId) {
    try {
      const { result } = await square.catalogApi.retrieveCatalogObject(p.catalogObjectId, true)
      const item = result.object
      if (item && item.itemData) {
        const newItemName = renameNom(item.itemData.name || '')
        const newVariations = (item.itemData.variations || []).map(v => ({
          ...v,
          itemVariationData: {
            ...v.itemVariationData,
            sku: renameSku(v.itemVariationData?.sku || ''),
          }
        }))
        if (!dryRun) {
          await square.catalogApi.upsertCatalogObject({
            idempotencyKey: `rename-luc-${p.catalogObjectId}-${Date.now()}`,
            object: {
              id: p.catalogObjectId,
              type: 'ITEM',
              version: item.version,
              itemData: {
                ...item.itemData,
                name: newItemName,
                variations: newVariations,
              },
            },
          })
        }
        nbSquare++
      }
    } catch (e) {
      console.log(`  ⚠ ${oldSku}: Square ${e.statusCode || 'err'} (item peut-être supprimé) — Firestore quand même update`)
      nbSkipped++
    }
  }

  // 2. Update Firestore
  if (!dryRun) await d.ref.update(updates)
  nbDone++
  if (nbDone % 20 === 0) console.log(`  ... ${nbDone}/${ps.size}`)
}
console.log(`\n✅ ${nbDone} Firestore updated, ${nbSquare} Square updated, ${nbSkipped} Square skipped (404 ?)`)

// 3. Chineuse trigramme
if (!dryRun) await db.collection('chineuse').doc('nan-goldies').update({ trigramme: 'LUC' })
console.log('✅ chineuse/nan-goldies.trigramme = LUC')

// 4. Iconiques
const ics = await db.collection('iconiques').where('chineuseTrigrammes', 'array-contains', 'NAN').get()
for (const d of ics.docs) {
  const newTrigs = (d.data().chineuseTrigrammes || []).map(t => t === 'NAN' ? 'LUC' : t)
  if (!dryRun) await d.ref.update({ chineuseTrigrammes: newTrigs })
  console.log(`✅ iconique ${d.id}: ${newTrigs.join(', ')}`)
}
process.exit(0)
