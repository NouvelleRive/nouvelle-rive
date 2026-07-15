import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })

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

// Cherche toutes ventes dont l'ID commence par 92WUnRVhCOFQcKg8jiUWavYIyU9YY ou RaLM1D4aD4ZUW3OERJQiVJ5JJbKZY
const orderIds = ['92WUnRVhCOFQcKg8jiUWavYIyU9YY', 'RaLM1D4aD4ZUW3OERJQiVJ5JJbKZY']

for (const orderId of orderIds) {
  const snap = await db.collection('ventes')
    .where('__name__', '>=', `${orderId}_`)
    .where('__name__', '<', `${orderId}_￿`)
    .get()
  console.log(`\n--- orderId ${orderId} : ${snap.docs.length} ventes ---`)
  for (const d of snap.docs) {
    const v = d.data()
    const date = v.dateVente?.toDate?.()?.toISOString?.().slice(0, 16) || '?'
    console.log(`  ${d.id}`)
    console.log(`    sku=${v.sku} tri=${v.trigramme} chineur=${v.chineur} prix=${v.prixVenteReel||v.prix}€ date=${date}`)
  }
}

// Pour chaque lineItemUid, cherche combien de fois il apparaît globalement
console.log('\n--- Recherche globale des lineItemUids dupliqués (juin 2026) ---')
const start = new Date(2026, 5, 1)
const end = new Date(2026, 6, 0, 23, 59, 59, 999)
const allRaw = await db.collection('ventes').where('source', '==', 'square').get()
const filtered = allRaw.docs.filter(d => {
  const dt = d.data().dateVente?.toDate?.()
  return dt && dt >= start && dt <= end
})
console.log(`Ventes square juin (toutes) : ${filtered.length}`)

const byLineItem = new Map()
for (const d of filtered) {
  const parts = d.id.split('_')
  if (parts.length < 2) continue
  const lineItemUid = parts.slice(1).join('_')
  if (!byLineItem.has(lineItemUid)) byLineItem.set(lineItemUid, [])
  byLineItem.get(lineItemUid).push({ id: d.id, sku: d.data().sku, tri: d.data().trigramme })
}
const dupLineItems = [...byLineItem.entries()].filter(([, arr]) => arr.length > 1)
console.log(`\nLineItemUids dupliqués : ${dupLineItems.length}`)
for (const [uid, arr] of dupLineItems) {
  console.log(`  lineItemUid=${uid} → ${arr.length}×`)
  arr.forEach(x => console.log(`    ${x.id} (${x.sku} / ${x.tri})`))
}

process.exit(0)
