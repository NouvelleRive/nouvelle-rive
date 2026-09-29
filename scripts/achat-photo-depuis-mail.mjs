// Pose la photo d'identification sur les pièces achat Vinted sans photo.
//
// Le mail « Ton reçu » ne contient ni photo ni lien. Le mail de conversation
// « Nouveau message à propos de … » contient, lui, un lien links.vinted.com
// dont le base64 encode l'id de l'annonce → on récupère la vraie photo
// (og:image de la page publique), on la passe en carré (cover) et on
// l'héberge sur Bunny. Si l'annonce n'existe plus, on retombe sur la vignette
// 150×210 du mail (ça sert juste à savoir de quelle pièce on parle).
//
// Usage : node scripts/achat-photo-depuis-mail.mjs [--go] [after:2026/09/01]
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '.env.local' })

const GO = process.argv.includes('--go')
const AFTER = (process.argv.find(a => a.startsWith('after:')) || 'after:2026/09/01').slice(6)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const fenv = {}
for (const l of readFileSync('functions/.env', 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) fenv[m[1]] = m[2] }

if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') }) })
const db = getFirestore()

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/&#0?39;/g, "'").replace(/[^a-z0-9]+/g, ' ').trim()

// 1. Pièces achat Vinted sans photo
const snap = await db.collection('produits').where('source', '==', 'achat-vinted').get()
const sansPhoto = []
snap.forEach(d => { const p = d.data()
  const aPhoto = p.photos?.face || (Array.isArray(p.imageUrls) && p.imageUrls.length) || p.imageUrl
  if (!aPhoto) sansPhoto.push({ ref: d.ref, sku: p.sku, titre: p.achatTitreOriginal || p.nom || '', n: norm(p.achatTitreOriginal || p.nom || '') })
})
console.log(`${sansPhoto.length} pièce(s) achat-vinted sans photo`)
if (!sansPhoto.length) process.exit(0)

// 2. Mails de conversation (seuls porteurs de l'id d'annonce)
const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_id: fenv.GOOGLE_CLIENT_ID, client_secret: fenv.GOOGLE_CLIENT_SECRET,
    refresh_token: fenv.GOOGLE_REFRESH_TOKEN_ACHATS, grant_type: 'refresh_token' }) })
const H = { Authorization: `Bearer ${(await tr.json()).access_token}` }
const b64 = d => Buffer.from(d.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
const findPart = (ps, mime) => { for (const p of ps) { if (p.mimeType === mime && p.body?.data) return p
  if (p.parts) { const s = findPart(p.parts, mime); if (s) return s } } return null }
const bodyOf = pl => { if (!pl) return ''
  if (pl.body?.data) return b64(pl.body.data)
  const ps = pl.parts || []
  const h = findPart(ps, 'text/html'); if (h?.body?.data) return b64(h.body.data)
  const p = findPart(ps, 'text/plain'); if (p?.body?.data) return b64(p.body.data)
  return '' }

let ids = [], page = ''
do { const j = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(`from:no-reply@vinted.fr subject:"Nouveau message" after:${AFTER}`)}&maxResults=200${page ? `&pageToken=${page}` : ''}`, { headers: H })).json()
  ids.push(...(j.messages || [])); page = j.nextPageToken || '' } while (page)
console.log(`${ids.length} mail(s) de conversation depuis ${AFTER}`)

const annonces = []  // { itemId, vignette, sujetTitre }
for (const m of ids) {
  const g = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, { headers: H })).json()
  const hd = {}; for (const h of g.payload?.headers || []) hd[h.name] = h.value
  const b = bodyOf(g.payload)
  let itemId = null
  for (const l of [...b.matchAll(/https:\/\/links\.vinted\.com\/t\/([A-Za-z0-9_\-=]+)/g)].map(x => x[1])) {
    try { const u = b64(l); const mm = u.match(/item\?id=(\d+)/); if (mm) { itemId = mm[1]; break } } catch {}
  }
  const vignette = (b.match(/https?:\/\/images\d*\.vinted\.net\/[^"'\s)]+/i) || [])[0] || null
  const sujet = (hd['Subject'] || '').replace(/^Nouveau message à propos de\s*/i, '')
  if (itemId || vignette) annonces.push({ itemId, vignette, sujet, date: Number(g.internalDate || 0) })
}
annonces.sort((a, b) => b.date - a.date)  // le plus récent d'abord

// Le sujet est tronqué au milieu (« Vintage vis..ne ») → match préfixe/suffixe.
const colle = (titrePiece, sujet) => {
  const s = norm(sujet), t = norm(titrePiece)
  if (!s || !t) return false
  if (t.includes(s) || s.includes(t)) return true
  const parts = sujet.split('..')
  if (parts.length === 2) {
    const [a, z] = parts.map(norm)
    return a.length >= 4 && t.startsWith(a.slice(0, Math.min(a.length, 18))) && (!z || t.endsWith(z))
  }
  return false
}

// Deux titres parlent-ils de la même pièce ? On compare les mots de 4+
// lettres, après avoir retiré le « | Vinted » que Vinted colle au og:title.
// Exigence : 2 mots communs. Un seul mot ne suffit que si les deux titres
// tiennent en un mot (« Lancel. ») — sinon une annonce nommée « Veste »
// matcherait n'importe quelle veste.
const recoupe = (a, b) => {
  const mots = s => new Set(norm(String(s).replace(/\s*\|\s*vinted\s*$/i, '')).split(' ').filter(w => w.length >= 4))
  const A = mots(a), B = mots(b)
  if (!A.size || !B.size) return false
  let communs = 0
  for (const w of A) if (B.has(w)) communs++
  if (communs === 0) return false
  if (A.size === 1 || B.size === 1) return A.size <= 2 && B.size <= 2
  return communs >= 2 && communs / Math.min(A.size, B.size) >= 0.5
}

const zone = process.env.BUNNY_STORAGE_ZONE, key = process.env.BUNNY_API_KEY, cdnBase = process.env.NEXT_PUBLIC_BUNNY_CDN_URL
if (GO && (!zone || !key || !cdnBase)) { console.error('❌ config Bunny manquante'); process.exit(1) }

let pose = 0
for (const p of sansPhoto) {
  const cand = annonces.find(a => colle(p.titre, a.sujet))
  if (!cand) { console.log(`—  ${p.sku} | aucun mail de conversation | ${p.titre.slice(0, 45)}`); continue }

  // Photo pleine taille via l'annonce, sinon vignette du mail
  let src = null, via = ''
  if (cand.itemId) {
    const r = await fetch(`https://www.vinted.fr/items/${cand.itemId}`, { headers: { 'User-Agent': UA } })
    if (r.ok) {
      const html = await r.text()
      const og = html.match(/<meta property="og:image" content="([^"]+)"/i)
      const ogT = html.match(/<meta property="og:title" content="([^"]+)"/i)
      // Garde-fou : un sujet générique (« Veste vintage ») peut matcher le
      // mauvais mail. On ne pose la photo que si le titre de l'annonce
      // recoupe vraiment celui de la pièce (mots communs).
      const ok = !ogT || recoupe(p.titre, ogT[1])
      if (!ok) { console.log(`⚠️  ${p.sku} | titre annonce « ${ogT[1].slice(0, 45)} » ≠ « ${p.titre.slice(0, 40)} » → ignoré`); continue }
      if (og) { src = og[1]; via = `annonce ${cand.itemId} « ${(ogT?.[1] || '?').slice(0, 45)} »` }
    }
  }
  if (!src && cand.vignette) { src = cand.vignette; via = 'vignette mail 150x210' }
  if (!src) { console.log(`—  ${p.sku} | annonce introuvable et pas de vignette | ${p.titre.slice(0, 40)}`); continue }

  if (!GO) { console.log(`·  ${p.sku} | ${via} | ${p.titre.slice(0, 40)}`); continue }

  const img = await fetch(src, { headers: { 'User-Agent': UA } })
  if (!img.ok) { console.log(`❌ ${p.sku} | téléchargement ${img.status}`); continue }
  // Photo Vinted = non détourée → carré par recadrage cover (règle photos carrées)
  const carre = await sharp(Buffer.from(await img.arrayBuffer()))
    .resize(1200, 1200, { fit: 'cover', position: 'centre' }).jpeg({ quality: 88 }).toBuffer()
  const path = `produits/${p.ref.id}_achat_${Date.now()}.jpg`
  const put = await fetch(`https://storage.bunnycdn.com/${zone}/${path}`, {
    method: 'PUT', headers: { AccessKey: key, 'Content-Type': 'image/jpeg' }, body: carre })
  if (!put.ok) { console.log(`❌ ${p.sku} | Bunny ${put.status}`); continue }
  const cdn = `${cdnBase}/${path}`
  const cur = (await p.ref.get()).data() || {}
  await p.ref.set({
    photos: { ...(cur.photos || {}), details: [...(cur.photos?.details || []), cdn] },
    imageUrls: [cdn, ...(Array.isArray(cur.imageUrls) ? cur.imageUrls : [])],
    imageUrl: cur.imageUrl || cdn,
    ...(cand.itemId ? { achatAnnonceUrl: `https://www.vinted.fr/items/${cand.itemId}` } : {}),
  }, { merge: true })
  pose++
  console.log(`✅ ${p.sku} | ${via} | ${p.titre.slice(0, 40)}`)
}
console.log(`\n${pose} photo(s) posée(s)`)
process.exit(0)
