// Rapproche les factures chineuses (NRmmaa-TRI) avec le virement bancaire
// correspondant. La référence est présente des deux côtés : numéro de facture
// et libellé de la transaction Shine. Simulation par défaut, --write pour agir.
import { config } from 'dotenv'
config({ path: '.env.local' })
const T = process.env.PENNYLANE_API_TOKEN
const base = 'https://app.pennylane.com/api/external/v2'
const ECRIRE = process.argv.includes('--write')
// Par défaut on ne rapproche que les factures dont le montant colle au virement.
// --tous force aussi celles qui diffèrent (à ne faire qu'après vérification).
const TOUS = process.argv.includes('--tous')

async function all(chemin) {
  let out = [], cursor = null
  for (let i = 0; i < 400; i++) {
    const u = new URL(base + chemin, base)
    u.searchParams.set('limit', '100')
    if (cursor) u.searchParams.set('cursor', cursor)
    const r = await fetch(u, { headers: { Authorization: `Bearer ${T}` } })
    if (!r.ok) { console.log(r.status, (await r.text()).slice(0, 200)); break }
    const j = await r.json()
    out = out.concat(j.items || [])
    if (!j.has_more) break
    cursor = j.next_cursor
    await new Promise(s => setTimeout(s, 150))
  }
  return out
}

const ref = (s) => (s || '').toUpperCase().match(/NR\d{4}-[A-Z0-9]+/)?.[0] || null

const factures = (await all('/supplier_invoices')).filter(f => ref(f.invoice_number))
const transactions = await all('/transactions')

const parRef = new Map()
for (const t of transactions) {
  const r = ref(t.label)
  if (!r) continue
  if (!parRef.has(r)) parRef.set(r, [])
  parRef.get(r).push(t)
}

let aLettrer = [], deja = 0, sansVirement = [], ambigu = []
for (const f of factures) {
  if (f.reconciled) { deja++; continue }
  const r = ref(f.invoice_number)
  const cands = parRef.get(r) || []
  if (!cands.length) { sansVirement.push(r); continue }
  if (cands.length > 1) { ambigu.push(`${r} (${cands.length} virements)`); continue }
  aLettrer.push({ f, t: cands[0], r })
}

console.log(`factures chineuses : ${factures.length}`)
console.log(`déjà rapprochées   : ${deja}`)
console.log(`à rapprocher       : ${aLettrer.length}`)
console.log(`sans virement      : ${sansVirement.length}`)
console.log(`ambiguës           : ${ambigu.length}`)

const ecart = aLettrer.filter(x => Math.abs(Math.abs(Number(x.t.amount)) - Number(x.f.currency_amount)) > 0.02)
console.log(`\ndont écart facture/virement > 0,02 € : ${ecart.length}`)
ecart.slice(0, 15).forEach(x => console.log('  ', x.r.padEnd(14), 'facture', x.f.currency_amount.padStart(9), 'virement', String(x.t.amount).padStart(10)))

if (sansVirement.length) console.log('\nsans virement :', sansVirement.slice(0, 30).join(' '))
if (ambigu.length) console.log('\nambiguës :', ambigu.slice(0, 20).join(' | '))

if (ECRIRE) {
  const cible = TOUS ? aLettrer : aLettrer.filter(x => !ecart.includes(x))
  console.log(`\nrapprochement de ${cible.length} factures…`)
  let ok = 0, ko = 0
  for (const x of cible) {
    const r = await fetch(`${base}/supplier_invoices/${x.f.id}/matched_transactions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: x.t.id }),
    })
    if (r.ok) { ok++ } else { ko++; console.log('échec', x.r, r.status, (await r.text()).slice(0, 150)) }
    await new Promise(s => setTimeout(s, 200))
  }
  console.log(`\nrapprochées : ${ok}   échecs : ${ko}`)
}
