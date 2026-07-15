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

console.log('Chargement de toute la collection ventes…')
const snap = await db.collection('ventes').get()
console.log(`${snap.docs.length} ventes total`)

// Doublons par lineItemUid (peut apparaître avec plusieurs orderIds différents)
const byLineItemUid = new Map()
for (const d of snap.docs) {
  const v = d.data()
  const uid = v.lineItemUid
  if (!uid) continue
  if (!byLineItemUid.has(uid)) byLineItemUid.set(uid, [])
  byLineItemUid.get(uid).push({
    id: d.id,
    orderId: v.orderId,
    sku: v.sku,
    tri: v.trigramme,
    prix: v.prixVenteReel || v.prix,
    date: v.dateVente?.toDate?.()?.toISOString?.().slice(0, 16),
    chineur: v.chineur,
  })
}

const dups = [...byLineItemUid.entries()].filter(([, arr]) => arr.length > 1)
console.log(`\n${dups.length} lineItemUids apparaissent dans PLUSIEURS docs`)

let totalDoublons = 0
let totalMontantDoublon = 0
const dupsByChineur = new Map()

for (const [uid, arr] of dups) {
  console.log(`\nlineItemUid=${uid} → ${arr.length}×`)
  for (const x of arr) {
    console.log(`  ${x.date} ${x.id.padEnd(65)} sku=${x.sku} tri=${x.tri} ${x.prix}€`)
  }
  // 1 vraie vente + (arr.length - 1) doublons
  const trueOne = arr[0]
  const nbDup = arr.length - 1
  totalDoublons += nbDup
  totalMontantDoublon += nbDup * (trueOne.prix || 0)
  const key = trueOne.tri || trueOne.chineur || '???'
  const cur = dupsByChineur.get(key) || { count: 0, montant: 0 }
  cur.count += nbDup
  cur.montant += nbDup * (trueOne.prix || 0)
  dupsByChineur.set(key, cur)
}

console.log(`\n=== RÉSUMÉ ===`)
console.log(`${totalDoublons} docs en trop, ${totalMontantDoublon}€ de CA fantôme`)
console.log('\nPar chineuse (trigramme) :')
const sorted = [...dupsByChineur.entries()].sort((a, b) => b[1].montant - a[1].montant)
for (const [tri, { count, montant }] of sorted) {
  console.log(`  ${tri.padEnd(15)} : ${count} doublons, ${montant}€`)
}

process.exit(0)
