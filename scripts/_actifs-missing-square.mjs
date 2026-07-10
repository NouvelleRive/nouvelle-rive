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

// 1. Square SKUs
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
console.log(`Square : ${squareSkus.size} SKUs`)

// 2. Firestore actifs manquants
const snap = await db.collection('produits').get()
const missing = []
snap.docs.forEach(d => {
  const p = d.data()
  const actif = !p.vendu && p.statut !== 'retour' && p.statut !== 'supprime' && (p.quantite ?? 1) > 0
  if (!actif) return
  const sku = (p.sku || '').toUpperCase()
  if (!sku) return
  if (squareSkus.has(sku)) return
  const dateCreated = p.createdAt?.toDate?.() || null
  const dateRecu = p.dateReception?.toDate?.() || null
  missing.push({
    sku,
    trig: (p.trigramme || '').toUpperCase(),
    recu: !!p.recu,
    hasSquareId: !!(p.variationId || p.catalogObjectId || p.itemId),
    photosReady: p.photosReady,
    hasPhoto: !!(p.imageUrls?.[0] || p.imageUrl || p.photos?.face),
    dateCreated: dateCreated ? dateCreated.toISOString().slice(0, 10) : '(?)',
    dateRecu: dateRecu ? dateRecu.toISOString().slice(0, 10) : '(?)',
    nom: (p.nom || p.Nom || '').slice(0, 50),
  })
})

console.log(`\nTotal actifs Firestore MANQUANT sur Square : ${missing.length}`)
console.log('\n=== Répartition par état ===')
const byRecu = missing.reduce((acc, m) => { acc[m.recu ? 'recu' : 'pas_recu']++; return acc }, { recu: 0, pas_recu: 0 })
console.log(`  reçus (recu=true) : ${byRecu.recu}`)
console.log(`  non reçus         : ${byRecu.pas_recu}`)
const withPhoto = missing.filter(m => m.hasPhoto).length
console.log(`  avec photo        : ${withPhoto}`)
const withSquareId = missing.filter(m => m.hasSquareId).length
console.log(`  avec ID Square (mais SKU pas trouvé) : ${withSquareId}`)

console.log('\n=== 20 échantillons ===')
missing.slice(0, 20).forEach(m => {
  console.log(`- ${m.sku.padEnd(10)} | trig=${m.trig.padEnd(4)} | recu=${m.recu ? 'Y' : 'N'} | photo=${m.hasPhoto ? 'Y' : 'N'} | crééle=${m.dateCreated} | ${m.nom}`)
})

// Par trigramme
console.log('\n=== Par trigramme ===')
const byTrig = new Map()
missing.forEach(m => byTrig.set(m.trig, (byTrig.get(m.trig) || 0) + 1))
;[...byTrig.entries()].sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`  ${t.padEnd(6)}: ${n}`))

process.exit(0)
