// Liste les reçus Vinted (lus ou non) depuis une date et dit lesquels n'ont pas
// de produit en base. Avec --go : poste au webhook UNIQUEMENT les manquants
// (jamais les existants : le webhook fait un merge qui écraserait les retouches).
// Usage : node scripts/_ach-recus-manquants.mjs [after:2026/08/25] [--go]
import { config } from 'dotenv'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
config({ path: '.env.local' })
const fenv = {}
for (const l of (await import('node:fs')).readFileSync('functions/.env', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) fenv[m[1]] = m[2]
}
const GO = process.argv.includes('--go')
const AFTER = (process.argv.find(a => a.startsWith('after:')) || 'after:2026/08/25').slice(6)
// --skip=tx1,tx2 : transactions à ne pas créer (déjà saisies à la main, ou remboursées)
const SKIP = new Set(((process.argv.find(a => a.startsWith('--skip=')) || '').slice(7) || '').split(',').filter(Boolean))
const BASE = 'https://www.nouvellerive.eu'

if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') }) })
const db = getFirestore()

const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_id: fenv.GOOGLE_CLIENT_ID, client_secret: fenv.GOOGLE_CLIENT_SECRET,
    refresh_token: fenv.GOOGLE_REFRESH_TOKEN_ACHATS, grant_type: 'refresh_token' }) })
const tok = await tr.json()
if (!tok.access_token) { console.error('❌ token:', JSON.stringify(tok)); process.exit(1) }
const H = { Authorization: `Bearer ${tok.access_token}` }

const q = encodeURIComponent(`from:no-reply@vinted.fr subject:"Ton reçu pour la commande" after:${AFTER}`)
let ids = [], page = ''
do {
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=500${page ? `&pageToken=${page}` : ''}`, { headers: H })
  const j = await r.json(); if (j.error) { console.error(JSON.stringify(j.error)); process.exit(1) }
  ids.push(...(j.messages || [])); page = j.nextPageToken || ''
} while (page)

const decode = (d) => Buffer.from(d.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
const findPart = (ps, mime) => { for (const p of ps) { if (p.mimeType === mime && p.body?.data) return p
  if (p.parts) { const s = findPart(p.parts, mime); if (s) return s } } return null }
const bodyOf = (pl) => { if (!pl) return ''
  if (pl.body?.data) return decode(pl.body.data)
  const ps = pl.parts || []
  const h = findPart(ps, 'text/html'); if (h?.body?.data) return decode(h.body.data)
  const p = findPart(ps, 'text/plain'); if (p?.body?.data) return decode(p.body.data)
  return '' }
const toText = (s) => s.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(tr|td|th|p|div|li)>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/ /g, ' ')
  .replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n')

const mails = []
for (const m of ids) {
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, { headers: H })
  const msg = await r.json(); if (msg.error) { console.error(m.id, JSON.stringify(msg.error)); continue }
  const hd = {}; for (const h of msg.payload?.headers || []) hd[h.name] = h.value
  const body = bodyOf(msg.payload)
  const txt = toText(body)
  const tid = (txt.match(/N°\s*de transaction\s+(\d+)/) || [])[1] || null
  const titre = (txt.match(/^Commande\s+(.+?)\s*$/m) || [])[1] || (hd['Subject'] || '')
  mails.push({ id: m.id, date: Number(msg.internalDate || 0), from: hd['From'] || '',
    subject: hd['Subject'] || '', body, tid, titre })
}
mails.sort((a, b) => a.date - b.date)

const manquants = []
for (const m of mails) {
  const d = new Date(m.date).toISOString().slice(0, 16)
  if (!m.tid) { console.log(`⚠️  ${d} | transaction illisible | ${m.subject.slice(0, 60)}`); continue }
  const snap = await db.collection('produits').doc(`vinted_${m.tid}`).get()
  if (snap.exists) {
    console.log(`✔️  ${d} | ${snap.data().sku} déjà en base | ${m.titre.slice(0, 45)}`)
  } else if (SKIP.has(m.tid)) {
    console.log(`⏭  ${d} | ignoré (--skip) | ${m.titre.slice(0, 45)}`)
  } else {
    console.log(`🆕 ${d} | MANQUANT | ${m.titre.slice(0, 45)} (tx ${m.tid})`)
    manquants.push(m)
  }
}
console.log(`\n${mails.length} reçu(s) depuis ${AFTER} — ${manquants.length} manquant(s)`)

if (GO && manquants.length) {
  console.log('\n--- création ---')
  for (const m of manquants) {
    const res = await fetch(`${BASE}/api/webhooks/gmail-achats`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': fenv.NR_INTERNAL_TOKEN },
      body: JSON.stringify({ gmailMessageId: m.id, from: m.from, subject: m.subject, body: m.body }) })
    const txt = await res.text(); let j = null; try { j = JSON.parse(txt) } catch {}
    console.log(`${j?.ok ? '✅' : '❌'} ${m.titre.slice(0, 40)} → ${txt.slice(0, 120)}`)
    if (j?.ok) await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}/modify`, {
      method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }) })
  }
}
process.exit(0)
