// Retire les bandes blanches sur toutes les photos des produits "trench".
// La liste des produits vient du cache blob (aucune lecture Firestore),
// on n'écrit que sur les docs réellement corrigés.
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

async function debander(input) {
  const img = sharp(input)
  const { width: W, height: H } = await img.metadata()
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const ch = info.channels
  const white = (x, y) => { const i = (y * W + x) * ch; return data[i] >= 250 && data[i+1] >= 250 && data[i+2] >= 250 }
  const colWhite = x => { for (let y = 0; y < H; y++) if (!white(x, y)) return false; return true }
  const rowWhite = y => { for (let x = 0; x < W; x++) if (!white(x, y)) return false; return true }
  let left = 0; while (left < W && colWhite(left)) left++
  let right = W - 1; while (right > left && colWhite(right)) right--
  let top = 0; while (top < H && rowWhite(top)) top++
  let bottom = H - 1; while (bottom > top && rowWhite(bottom)) bottom--
  const w = right - left + 1, h = bottom - top + 1
  if (W - w < 8 && H - h < 8) return null
  if (w < W * 0.5 || h < H * 0.5) return null

  // On ne prolonge que du fond clair uni : si le bord contient le sujet,
  // copier l'étalerait sur tout le carré → on laisse l'image tranquille.
  const fond = (x, y) => {
    const i = (y * W + x) * ch
    const [r, g, b] = [data[i], data[i+1], data[i+2]]
    return Math.min(r, g, b) >= 200 && Math.max(r, g, b) - Math.min(r, g, b) <= 25
  }
  const colFond = x => { for (let y = top; y <= bottom; y++) if (!fond(x, y)) return false; return true }
  const rowFond = y => { for (let x = left; x <= right; x++) if (!fond(x, y)) return false; return true }
  if (left > 0 && !colFond(left)) return null
  if (right < W - 1 && !colFond(right)) return null
  if (top > 0 && !rowFond(top)) return null
  if (bottom < H - 1 && !rowFond(bottom)) return null

  return {
    bandes: { left, right: W - 1 - right, top, bottom: H - 1 - bottom },
    buffer: await sharp(input)
      .extract({ left, top, width: w, height: h })
      .extend({
        left: Math.floor((W - w) / 2), right: Math.ceil((W - w) / 2),
        top: Math.floor((H - h) / 2), bottom: Math.ceil((H - h) / 2),
        extendWith: 'copy',
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer(),
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

// Liste des trench depuis le cache blob (gratuit)
const [buf] = await getStorage().bucket().file('_cache/produits-all.json.gz').download()
const raw = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf
const parsed = JSON.parse(raw.toString())
// le cache stocke { id, raw } → on remet à plat
const tous = (Array.isArray(parsed) ? parsed : Object.values(parsed).find(Array.isArray))
  .map(e => (e && e.raw ? { id: e.id, ...e.raw } : e))
const trenches = tous.filter(p => /trench/i.test(`${p.nom || ''} ${p.categorie || ''} ${p.sousCategorie || ''}`))
console.log(`${trenches.length} trench dans le cache (sur ${tous.length} produits)`)

let checked = 0, touched = 0, docs = 0
for (const p of trenches) {
  const mapping = new Map()
  const urls = [...new Set([
    p.photos?.face, p.photos?.dos, p.photos?.faceOnModel, p.photos?.dosOnModel,
    ...(p.photos?.details || []), ...(p.imageUrls || []), p.imageUrl,
  ].filter(Boolean))]
  for (const url of urls) {
    checked++
    try {
      const r = await fetch(url)
      if (!r.ok) continue
      const fixed = await debander(Buffer.from(await r.arrayBuffer()))
      if (!fixed) continue
      console.log(`  ${p.sku} — bandes`, fixed.bandes)
      mapping.set(url, DRY ? url : await upload(fixed.buffer))
      touched++
    } catch (e) {
      console.warn('  erreur', p.sku, e.message)
    }
  }
  if (!mapping.size || DRY) continue
  const sub = u => (u ? mapping.get(u) || u : u)
  // Le cache blob peut être daté : on repart de la fiche Firestore à jour
  const ref = db.collection('produits').doc(p.id)
  const snap = await ref.get()
  if (!snap.exists) continue
  const cur = snap.data()
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
  docs++
}
console.log(`\n${trenches.length} trench, ${checked} images vérifiées, ${touched} corrigées, ${docs} fiches mises à jour${DRY ? ' (dry-run)' : ''}`)
