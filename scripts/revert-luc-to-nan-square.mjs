// REVERT : remet LUC → NAN partout
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

const renameSku = (s) => !s ? s : s.startsWith('LUC') ? 'NAN' + s.slice(3) : s
const renameNom = (s) => !s ? s : s.replace(/^LUC(\d+)/, 'NAN$1').replace(/^LUC /, 'NAN ').replace(/^LUC-/, 'NAN-')

const ps = await db.collection('produits').where('trigramme', '==', 'LUC').get()
console.log(`\n${ps.size} produits LUC à reverter`)

let nbDone = 0, nbSquare = 0, nbSkipped = 0
for (const d of ps.docs) {
  const p = d.data()
  const oldSku = p.sku || ''
  const newSku = renameSku(oldSku)
  const newNom = renameNom(p.nom || '')
  const updates = { trigramme: 'NAN' }
  if (newSku !== oldSku) updates.sku = newSku
  if (newNom !== p.nom) updates.nom = newNom

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
            idempotencyKey: `revert-nan-${p.catalogObjectId}-${Date.now()}`,
            object: {
              id: p.catalogObjectId,
              type: 'ITEM',
              version: item.version,
              itemData: { ...item.itemData, name: newItemName, variations: newVariations },
            },
          })
        }
        nbSquare++
      }
    } catch (e) {
      console.log(`  ⚠ ${oldSku}: Square ${e.statusCode || 'err'}`)
      nbSkipped++
    }
  }

  if (!dryRun) await d.ref.update(updates)
  nbDone++
  if (nbDone % 30 === 0) console.log(`  ... ${nbDone}/${ps.size}`)
}
console.log(`\n✅ ${nbDone} Firestore reverted, ${nbSquare} Square reverted, ${nbSkipped} skipped`)

if (!dryRun) await db.collection('chineuse').doc('nan-goldies').update({ trigramme: 'NAN' })
console.log('✅ chineuse/nan-goldies.trigramme = NAN')

const ics = await db.collection('iconiques').where('chineuseTrigrammes', 'array-contains', 'LUC').get()
for (const d of ics.docs) {
  const newTrigs = (d.data().chineuseTrigrammes || []).map(t => t === 'LUC' ? 'NAN' : t)
  if (!dryRun) await d.ref.update({ chineuseTrigrammes: newTrigs })
  console.log(`✅ iconique ${d.id}: ${newTrigs.join(', ')}`)
}
process.exit(0)
