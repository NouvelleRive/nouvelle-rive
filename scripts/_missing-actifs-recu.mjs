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

// Square SKUs
console.log('Scan Square…')
let cursor
const squareSkus = new Set()
do {
  const { result } = await client.catalogApi.listCatalog(cursor, 'ITEM')
  for (const obj of result.objects || []) {
    for (const v of (obj.itemData?.variations || [])) {
      const sku = (v.itemVariationData?.sku || '').toUpperCase()
      if (sku) squareSkus.add(sku)
    }
  }
  cursor = result.cursor
} while (cursor)
console.log(`Square : ${squareSkus.size} SKUs\n`)

// Actifs recu=true manquants
const snap = await db.collection('produits').get()
const missing = []
snap.docs.forEach(d => {
  const p = d.data()
  const actif = !p.vendu && p.statut !== 'retour' && p.statut !== 'supprime' && (p.quantite ?? 1) > 0
  if (!actif) return
  if (!p.recu) return
  const sku = (p.sku || '').toUpperCase()
  if (!sku || squareSkus.has(sku)) return
  const dateRecu = p.dateReception?.toDate?.() || null
  const dateCreated = p.createdAt?.toDate?.() || null
  const squareSyncedAt = p.squareSyncedAt?.toDate?.() || null
  missing.push({
    id: d.id,
    sku,
    trig: (p.trigramme || '').toUpperCase(),
    nom: (p.nom || p.Nom || '').slice(0, 60),
    prix: p.prix,
    hasIds: !!(p.variationId || p.catalogObjectId || p.itemId),
    variationId: (p.variationId || p.catalogObjectId || '').slice(0, 12),
    itemId: (p.itemId || '').slice(0, 12),
    dateRecu: dateRecu ? dateRecu.toISOString().slice(0, 10) : '(?)',
    dateCreated: dateCreated ? dateCreated.toISOString().slice(0, 10) : '(?)',
    squareSyncedAt: squareSyncedAt ? squareSyncedAt.toISOString().slice(0, 10) : '(?)',
    hasSquareSyncedAt: !!p.squareSyncedAt,
  })
})

console.log(`Total actifs recu=true manquants sur Square : ${missing.length}\n`)

console.log('sku       | trig | recuLe     | crééLe     | squareSyncedAt| hasIds | prix  | nom')
console.log('----------|------|------------|------------|---------------|--------|-------|-----')
missing.forEach(m => {
  console.log(`${m.sku.padEnd(10)}| ${m.trig.padEnd(4)} | ${m.dateRecu} | ${m.dateCreated} | ${m.squareSyncedAt.padEnd(13)} | ${(m.hasIds ? 'YES' : 'NO').padEnd(6)} | ${String(m.prix || '').padStart(5)} | ${m.nom}`)
})

// Analyse : quelles catégories ?
console.log('\n=== Diagnostic ===')
const hadIds = missing.filter(m => m.hasIds).length
console.log(`Avec IDs Square en Firestore (=> sync a POUSSÉ à un moment) : ${hadIds}`)
console.log(`Sans IDs Square (=> sync n'a JAMAIS tourné pour ces produits) : ${missing.length - hadIds}`)
const hadSyncedAt = missing.filter(m => m.hasSquareSyncedAt).length
console.log(`Avec squareSyncedAt = jamais sync : ${missing.length - hadSyncedAt}`)

process.exit(0)
