// Test si un token donné est utilisable comme EBAY_REFRESH_TOKEN.
// Tente l'échange refresh_token → access_token via /identity/v1/oauth2/token.
// Usage : node scripts/test-ebay-token.mjs '<token>'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

const TOKEN = process.argv[2]
if (!TOKEN) { console.error('Usage : node scripts/test-ebay-token.mjs "<token>"'); process.exit(1) }

const ENV = (process.env.EBAY_ENVIRONMENT || 'production')
const AUTH_URL = ENV === 'production'
  ? 'https://api.ebay.com/identity/v1/oauth2/token'
  : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'

const CID = process.env.EBAY_CLIENT_ID
const SEC = process.env.EBAY_CLIENT_SECRET
if (!CID || !SEC) { console.error('EBAY_CLIENT_ID / EBAY_CLIENT_SECRET manquants'); process.exit(1) }

const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.marketing',
].join(' ')

const creds = Buffer.from(`${CID}:${SEC}`).toString('base64')

console.log(`🔐 Test auth eBay (${ENV}) avec token de ${TOKEN.length} chars…\n`)

const res = await fetch(AUTH_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${creds}` },
  body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(TOKEN)}&scope=${encodeURIComponent(SCOPES)}`,
})

const body = await res.text()
let parsed
try { parsed = JSON.parse(body) } catch { parsed = { raw: body } }

console.log(`HTTP ${res.status}`)
console.log(parsed)

if (res.ok && parsed.access_token) {
  console.log(`\n✅ Token VALIDE comme refresh_token. expires_in=${parsed.expires_in}s`)
  console.log('→ Tu peux remplacer EBAY_REFRESH_TOKEN dans .env.local par ce token.')
} else {
  console.log(`\n❌ Token PAS utilisable comme refresh_token.`)
}
process.exit(0)
