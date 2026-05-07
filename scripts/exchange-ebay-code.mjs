// Échange un code OAuth eBay (issu du callback) contre access_token + refresh_token.
// Usage : node scripts/exchange-ebay-code.mjs '<code>'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

const CODE_RAW = process.argv[2]
if (!CODE_RAW) { console.error('Usage : node scripts/exchange-ebay-code.mjs "<code>"'); process.exit(1) }
const CODE = decodeURIComponent(CODE_RAW)

const ENV = (process.env.EBAY_ENVIRONMENT || 'production')
const AUTH_URL = ENV === 'production'
  ? 'https://api.ebay.com/identity/v1/oauth2/token'
  : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'

const CID = process.env.EBAY_CLIENT_ID
const SEC = process.env.EBAY_CLIENT_SECRET
const RUNAME = 'NR1_sas-NR1sas-NOUVELLE-bsodojg'

const creds = Buffer.from(`${CID}:${SEC}`).toString('base64')

console.log(`🔁 Échange code → tokens (env=${ENV})…\n`)

const res = await fetch(AUTH_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${creds}` },
  body: `grant_type=authorization_code&code=${encodeURIComponent(CODE)}&redirect_uri=${encodeURIComponent(RUNAME)}`,
})

const body = await res.text()
let parsed
try { parsed = JSON.parse(body) } catch { parsed = { raw: body } }

console.log(`HTTP ${res.status}`)

if (!res.ok) {
  console.log(parsed)
  console.log('\n❌ Échec échange.')
  process.exit(1)
}

console.log(`✅ Succès.`)
console.log(`\naccess_token (expire dans ${parsed.expires_in}s) :`)
console.log(parsed.access_token)
console.log(`\n🔑 refresh_token (à mettre dans .env.local comme EBAY_REFRESH_TOKEN, expire dans ${parsed.refresh_token_expires_in}s ≈ ${Math.round(parsed.refresh_token_expires_in / 86400)}j) :`)
console.log(parsed.refresh_token)
process.exit(0)
