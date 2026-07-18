// Prolonge le fond studio jusqu'aux bords du carré sur TOUTES les photos.
// Usage : node scripts/_prolonger-fond-tous.mjs [--dry] [filtre-nom]
// Une colonne de fond prise juste à côté du sujet est étirée vers le bord :
// le dégradé gris et l'ombre au sol continuent, plus aucune zone blanche.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { gunzipSync } from 'node:zlib'
import sharp from 'sharp'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })

const DRY = process.argv.includes('--dry')

if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })

const db = getFirestore()

async function prolongerFond(buf) {
  const img = sharp(buf)
  const { width: W, height: H } = await img.metadata()
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const ch = info.channels
  const sujet = (x, y) => {
    const i = (y * W + x) * ch
    const [r, g, b] = [data[i], data[i+1], data[i+2]]
    return Math.min(r, g, b) < 215 || Math.max(r, g, b) - Math.min(r, g, b) > 25
  }
  const colOk = x => { let n = 0; for (let y = 0; y < H; y++) if (sujet(x, y)) n++; return n > H * 0.005 }
  let x0 = 0; while (x0 < W && !colOk(x0)) x0++
  let x1 = W - 1; while (x1 > x0 && !colOk(x1)) x1--
  if (x0 >= x1) return null // aucun sujet détecté

  const margeG = Math.max(0, x0 - 12)
  const largeurD = W - 1 - Math.min(W - 1, x1 + 12)
  const margeD = Math.min(W - 1, x1 + 12)
  if (margeG < 20 && largeurD < 20) return null // déjà plein bord à bord

  // La colonne étirée doit être un fond lisse (studio). Sur une photo d'intérieur
  // elle contient des contours → l'étirer ferait des traînées, on s'abstient.
  const colLisse = x => {
    let ecartMax = 0
    for (let y = 1; y < H; y++) {
      const i = (y * W + x) * ch, j = ((y - 1) * W + x) * ch
      ecartMax = Math.max(ecartMax, Math.abs(data[i] - data[j]), Math.abs(data[i+1] - data[j+1]), Math.abs(data[i+2] - data[j+2]))
    }
    return ecartMax <= 12
  }
  if (margeG >= 20 && !colLisse(margeG)) return null
  if (largeurD >= 20 && !colLisse(margeD)) return null

  const pieces = []
  if (margeG >= 20) {
    pieces.push({
      input: await sharp(buf).extract({ left: margeG, top: 0, width: 1, height: H })
        .resize(margeG, H, { fit: 'fill' }).toBuffer(),
      left: 0, top: 0,
    })
  }
  if (largeurD >= 20) {
    pieces.push({
      input: await sharp(buf).extract({ left: margeD, top: 0, width: 1, height: H })
        .resize(largeurD, H, { fit: 'fill' }).toBuffer(),
      left: margeD + 1, top: 0,
    })
  }
  if (!pieces.length) return null
  return {
    zone: { sujet: `${x0}-${x1}`, gauche: margeG, droite: largeurD },
    buffer: await sharp(buf).composite(pieces).flatten({ background: { r: 255, g: 255, b: 255 } }).png().toBuffer(),
  }
}

async function upload(buffer) {
  const path = `produits/conserved_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`
  const res = await fetch(`https://storage.bunnycdn.com/${process.env.BUNNY_STORAGE_ZONE}/${path}`, {
    method: 'PUT',
    headers: { AccessKey: process.env.BUNNY_API_KEY, 'Content-Type': 'image/png' },
    body: buffer,
  })
  if (!res.ok) throw new Error('upload Bunny ' + res.status)
  return `${process.env.NEXT_PUBLIC_BUNNY_CDN_URL}/${path}`
}

async function traiter(urls) {
  const mapping = new Map()
  for (const url of urls) {
    try {
      const r = await fetch(url)
      if (!r.ok) continue
      const fixed = await prolongerFond(Buffer.from(await r.arrayBuffer()))
      if (!fixed) continue
      console.log('   ', fixed.zone)
      mapping.set(url, DRY ? url : await upload(fixed.buffer))
    } catch (e) {
      console.warn('    erreur', e.message)
    }
  }
  return mapping
}

// --- Iconiques trench ---
const icoSnap = await db.collection('iconiques').get()
for (const doc of icoSnap.docs) {
  const images = doc.data().images || []
  console.log(`iconique ${doc.data().slug} — ${images.length} images`)
  const map = await traiter(images)
  if (map.size && !DRY) await doc.ref.update({ images: images.map(u => map.get(u) || u) })
  console.log(`  ${map.size} prolongées`)
}

// --- Produits trench (liste depuis le cache blob, gratuit) ---
const [blob] = await getStorage().bucket().file('_cache/produits-all.json.gz').download()
const raw = blob[0] === 0x1f && blob[1] === 0x8b ? gunzipSync(blob) : blob
const parsed = JSON.parse(raw.toString())
const tous = (Array.isArray(parsed) ? parsed : Object.values(parsed).find(Array.isArray))
  .map(e => (e && e.raw ? { id: e.id, ...e.raw } : e))
const filtre = process.argv.slice(2).find(a => !a.startsWith('--'))
const trenches = filtre
  ? tous.filter(p => new RegExp(filtre, 'i').test(`${p.nom || ''} ${p.categorie || ''} ${p.sousCategorie || ''}`))
  : tous
console.log(`${trenches.length} produits à traiter${filtre ? ` (filtre "${filtre}")` : ''}`)

let total = 0
for (const p of trenches) {
  const urls = [...new Set([
    p.photos?.face, p.photos?.dos, p.photos?.faceOnModel, p.photos?.dosOnModel,
    ...(p.photos?.details || []), ...(p.imageUrls || []), p.imageUrl,
  ].filter(Boolean))]
  const map = await traiter(urls)
  if (!map.size) continue
  console.log(`  ${p.sku} — ${map.size} prolongées`)
  total += map.size
  if (DRY) continue
  const ref = db.collection('produits').doc(p.id)
  const snap = await ref.get()
  if (!snap.exists) continue
  const cur = snap.data()
  const sub = u => (u ? map.get(u) || u : u)
  const update = {}
  if (cur.photos) update.photos = {
    ...cur.photos,
    ...(cur.photos.face ? { face: sub(cur.photos.face) } : {}),
    ...(cur.photos.dos ? { dos: sub(cur.photos.dos) } : {}),
    ...(cur.photos.faceOnModel ? { faceOnModel: sub(cur.photos.faceOnModel) } : {}),
    ...(cur.photos.dosOnModel ? { dosOnModel: sub(cur.photos.dosOnModel) } : {}),
    ...(cur.photos.details ? { details: cur.photos.details.map(sub) } : {}),
  }
  if (cur.imageUrls) update.imageUrls = cur.imageUrls.map(sub)
  if (cur.imageUrl) update.imageUrl = sub(cur.imageUrl)
  await ref.update(update)
}
console.log(`\n${total} photos produits prolongées${DRY ? ' (dry-run)' : ''}`)
