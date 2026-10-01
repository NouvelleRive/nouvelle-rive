// Pose la photo d'une annonce Vinted précise sur un SKU précis.
//
// Le script auto (achat-photo-depuis-mail.mjs) refuse un match quand le
// og:title de l'annonce ne recoupe pas le titre du reçu — ce qui arrive quand
// le vendeur a renommé son annonce après coup. Ici le couple SKU/annonce est
// donné à la main, donc pas de garde-fou de titre : c'est l'humain qui valide.
//
// Usage : node scripts/achat-photo-manuelle.mjs ACH37=9558856933 [...] [--go]
import sharp from 'sharp'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '.env.local' })

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const GO = process.argv.includes('--go')
const PAIRS = process.argv.slice(2).filter(a => a.includes('=')).map(a => a.split('='))

if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') }) })
const db = getFirestore()

const zone = process.env.BUNNY_STORAGE_ZONE, key = process.env.BUNNY_API_KEY, cdnBase = process.env.NEXT_PUBLIC_BUNNY_CDN_URL
if (GO && (!zone || !key || !cdnBase)) { console.error('❌ config Bunny manquante'); process.exit(1) }

for (const [sku, itemId] of PAIRS) {
  const q = await db.collection('produits').where('sku', '==', sku).limit(1).get()
  if (q.empty) { console.log(`❌ ${sku} introuvable`); continue }
  const ref = q.docs[0].ref, cur = q.docs[0].data()
  if (cur.photos?.face || (Array.isArray(cur.imageUrls) && cur.imageUrls.length) || cur.imageUrl) {
    console.log(`—  ${sku} a déjà une photo, skip`); continue
  }

  const page = await fetch(`https://www.vinted.fr/items/${itemId}`, { headers: { 'User-Agent': UA } })
  if (!page.ok) { console.log(`❌ ${sku} | annonce ${itemId} HTTP ${page.status}`); continue }
  const html = await page.text()
  const src = html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1]
  const titre = html.match(/<meta property="og:title" content="([^"]{0,60})"/i)?.[1] || '?'
  if (!src) { console.log(`❌ ${sku} | pas d'og:image`); continue }
  if (!GO) { console.log(`·  ${sku} ← annonce ${itemId} « ${titre} » (dry-run)`); continue }

  const img = await fetch(src, { headers: { 'User-Agent': UA } })
  if (!img.ok) { console.log(`❌ ${sku} | téléchargement ${img.status}`); continue }
  // Photo Vinted = non détourée → carré par recadrage cover (règle photos carrées)
  const carre = await sharp(Buffer.from(await img.arrayBuffer()))
    .resize(1200, 1200, { fit: 'cover', position: 'centre' }).jpeg({ quality: 88 }).toBuffer()

  const path = `produits/${ref.id}_achat_${Date.now()}.jpg`
  const put = await fetch(`https://storage.bunnycdn.com/${zone}/${path}`, {
    method: 'PUT', headers: { AccessKey: key, 'Content-Type': 'image/jpeg' }, body: carre })
  if (!put.ok) { console.log(`❌ ${sku} | Bunny ${put.status}`); continue }
  const cdn = `${cdnBase}/${path}`

  await ref.set({
    photos: { ...(cur.photos || {}), details: [...(cur.photos?.details || []), cdn] },
    imageUrls: [cdn, ...(Array.isArray(cur.imageUrls) ? cur.imageUrls : [])],
    imageUrl: cur.imageUrl || cdn,
    achatAnnonceUrl: `https://www.vinted.fr/items/${itemId}`,
  }, { merge: true })
  console.log(`✅ ${sku} ← annonce ${itemId} « ${titre} »`)
}
process.exit(0)
