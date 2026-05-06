// Retire d'eBay les produits qui ne sont plus sur le site (vendus, repris, supprimés, stock 0).
// Usage : node scripts/cleanup-ebay-listings.mjs           → dry-run (liste seulement)
//         node scripts/cleanup-ebay-listings.mjs --apply   → exécute le retrait
import 'dotenv/config'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const APPLY = process.argv.includes('--apply')

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()

const EBAY_ENV = (process.env.EBAY_ENVIRONMENT || 'sandbox')
const EBAY_API = EBAY_ENV === 'production' ? 'https://api.ebay.com' : 'https://api.sandbox.ebay.com'
const EBAY_AUTH = `${EBAY_API}/identity/v1/oauth2/token`
const EBAY_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.marketing',
].join(' ')

let cachedToken = null
async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.accessToken
  const creds = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(EBAY_AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${creds}` },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(process.env.EBAY_REFRESH_TOKEN)}&scope=${encodeURIComponent(EBAY_SCOPES)}`,
  })
  if (!res.ok) throw new Error(`Auth eBay: ${res.status} ${await res.text()}`)
  const data = await res.json()
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return cachedToken.accessToken
}

async function ebayCall(endpoint, method = 'GET') {
  const token = await getAccessToken()
  const res = await fetch(`${EBAY_API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Content-Language': 'en-US',
      'Accept-Language': 'en-US',
    },
  })
  const text = await res.text()
  if (!res.ok) {
    let parsed
    try { parsed = JSON.parse(text) } catch { parsed = { rawResponse: text } }
    throw new Error(parsed?.errors?.[0]?.message || `${res.status} ${text}`)
  }
  return text ? JSON.parse(text) : {}
}

function reasonFor(p) {
  if (p.vendu === true) return 'vendu'
  if (p.statut === 'retour') return 'repris (statut=retour)'
  if (p.statut === 'supprime') return 'supprimé (statut=supprime)'
  if (typeof p.quantite === 'number' && p.quantite <= 0) return 'stock 0'
  return null
}

const snap = await db.collection('produits').get()
const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
const candidates = all
  .filter(p => p.ebayListingId || p.ebayOfferId)
  .map(p => ({ p, reason: reasonFor(p) }))
  .filter(x => x.reason)

console.log(`\n📦 Produits avec eBay listing total : ${all.filter(p => p.ebayListingId || p.ebayOfferId).length}`)
console.log(`🎯 Candidats à retirer (plus sur le site) : ${candidates.length}\n`)

if (candidates.length === 0) {
  console.log('Rien à faire.')
  process.exit(0)
}

console.log('SKU                  | listingId       | offerId         | raison              | titre')
console.log('---------------------|-----------------|-----------------|---------------------|-----------------------------------')
for (const { p, reason } of candidates) {
  const sku = (p.sku || p.id || '').padEnd(20).slice(0, 20)
  const lst = (p.ebayListingId || '-').padEnd(15).slice(0, 15)
  const off = (p.ebayOfferId || '-').padEnd(15).slice(0, 15)
  const rea = reason.padEnd(19).slice(0, 19)
  const tit = (p.nom || p.titre || '').slice(0, 50)
  console.log(`${sku} | ${lst} | ${off} | ${rea} | ${tit}`)
}

if (!APPLY) {
  console.log(`\n💡 Dry-run. Pour exécuter le retrait : node scripts/cleanup-ebay-listings.mjs --apply`)
  process.exit(0)
}

console.log(`\n🚀 Mode --apply : retrait effectif sur eBay…\n`)
let okCount = 0
let failCount = 0
for (const { p, reason } of candidates) {
  const sku = p.sku
  const offerId = p.ebayOfferId
  const label = `${sku || p.id} (${reason})`
  try {
    if (offerId) {
      try { await ebayCall(`/sell/inventory/v1/offer/${offerId}/withdraw`, 'POST'); console.log(`  ↳ withdraw offer ${offerId} ✅`) }
      catch (e) { console.log(`  ↳ withdraw offer ${offerId} ⚠️ ${e.message}`) }
    }
    if (sku) {
      try { await ebayCall(`/sell/inventory/v1/inventory_item/${sku}`, 'DELETE'); console.log(`  ↳ delete inventory ${sku} ✅`) }
      catch (e) { console.log(`  ↳ delete inventory ${sku} ⚠️ ${e.message}`) }
    }
    const newPublishedOn = Array.isArray(p.publishedOn) ? p.publishedOn.filter(s => s !== 'ebay') : []
    await db.collection('produits').doc(p.id).update({
      ebayListingId: null,
      ebayOfferId: null,
      ebayPublishedAt: null,
      publishedOn: newPublishedOn,
    })
    console.log(`✅ ${label}`)
    okCount++
  } catch (e) {
    console.log(`❌ ${label} : ${e.message}`)
    failCount++
  }
}

console.log(`\n📊 Terminé : ${okCount} retiré(s), ${failCount} échec(s)`)
process.exit(0)
