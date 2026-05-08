// Backfill des "remarques" Square sur les ventes déjà loggées sans nom.
// Pour chaque vente sans `nom` ni `remarque`, on récupère l'order Square
// via son orderId et on enregistre order.note (ou lineItem.note) dans `remarque`.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { Client, Environment } from 'square'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const accessToken = process.env.SQUARE_ACCESS_TOKEN
if (!accessToken) {
  console.error('❌ SQUARE_ACCESS_TOKEN manquant dans l\'environnement')
  process.exit(1)
}
const square = new Client({
  accessToken,
  environment: process.env.SQUARE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
})

const DRY = process.argv.includes('--dry')

const snap = await db.collection('ventes').get()
console.log(`Ventes total: ${snap.size}`)

const candidates = snap.docs.filter(d => {
  const v = d.data()
  const noNom = !v.nom || /^vente sans nom$/i.test(v.nom)
  const noRemarque = !v.remarque
  return noNom && noRemarque && v.orderId
})
console.log(`Candidates (sans nom & sans remarque & avec orderId): ${candidates.length}`)

const cache = new Map()
let updated = 0
let noNote = 0
let errors = 0

for (const doc of candidates) {
  const v = doc.data()
  try {
    let order = cache.get(v.orderId)
    if (!order) {
      const { result } = await square.ordersApi.retrieveOrder(v.orderId)
      order = result.order
      cache.set(v.orderId, order)
    }
    const orderNote = order?.note || null
    const lineItem = (order?.lineItems || []).find(li => li.uid === v.lineItemUid)
    const itemNote = lineItem?.note || null
    const remarque = itemNote || orderNote || null

    if (!remarque) {
      noNote++
      continue
    }

    if (DRY) {
      console.log(`[DRY] ${doc.id} → "${remarque}"`)
    } else {
      await doc.ref.update({ remarque })
      console.log(`✅ ${doc.id} → "${remarque}"`)
    }
    updated++
  } catch (e) {
    errors++
    console.warn(`⚠️ ${doc.id} (order ${v.orderId}):`, e?.message || e)
  }
}

console.log(`\n📊 Récap : ${updated} maj${DRY ? ' (dry)' : ''}, ${noNote} sans note, ${errors} erreurs`)
