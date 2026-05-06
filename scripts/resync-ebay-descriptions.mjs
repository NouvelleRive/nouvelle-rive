// Re-pousse les descriptions Firestore vers eBay sur tous les produits déjà publiés.
// Appelle l'endpoint /api/ebay/resync POST en prod, un produit à la fois.

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()

const BASE_URL = process.argv.find(a => a.startsWith('--url='))?.split('=')[1] || 'https://www.nouvellerive.eu'

const snap = await db.collection('produits').where('ebayListingId', '!=', null).get()
const produits = snap.docs.map(d => ({ id: d.id, ...d.data() }))

console.log(`📋 ${produits.length} produits à re-synchroniser sur eBay\n`)
console.log(`Endpoint : ${BASE_URL}/api/ebay/resync\n`)

const ok = []
const ko = []

for (let i = 0; i < produits.length; i++) {
  const p = produits[i]
  try {
    const res = await fetch(`${BASE_URL}/api/ebay/resync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: p.id }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.success) {
      ok.push(p.sku)
      process.stdout.write(`\r✓ ${i + 1}/${produits.length} (ok: ${ok.length}, ko: ${ko.length})`)
    } else {
      ko.push({ sku: p.sku, error: data.error })
      process.stdout.write(`\r❌ ${i + 1}/${produits.length} (ok: ${ok.length}, ko: ${ko.length}) — ${p.sku}: ${data.error}\n`)
    }
  } catch (e) {
    ko.push({ sku: p.sku, error: e.message })
    process.stdout.write(`\r❌ ${i + 1}/${produits.length} ${p.sku}: ${e.message}\n`)
  }
}

console.log(`\n\n✅ ${ok.length} produits resynchronisés`)
if (ko.length > 0) {
  console.log(`❌ ${ko.length} échecs :`)
  for (const k of ko) console.log(`   - ${k.sku}: ${k.error}`)
}

process.exit(0)
