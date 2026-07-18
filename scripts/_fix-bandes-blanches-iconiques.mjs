// Retire les bandes blanches des images des iconiques : recadre la bande,
// puis ré-étend en copiant les pixels du bord (fond studio prolongé).
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import sharp from 'sharp'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })

const DRY = process.argv.includes('--dry')

if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
})})
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
  // Bande cosmétique seulement : on ignore <8px, et on refuse de "réparer" une image
  // quasi entièrement blanche (packshot détouré sur fond blanc)
  if (W - w < 8 && H - h < 8) return null
  if (w < W * 0.5 || h < H * 0.5) return null

  // On ne prolonge que du fond studio : si la ligne de bord contient du sujet
  // (pixel foncé ou coloré), copier l'étalerait sur tout le carré → on laisse tel quel.
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

const snap = await db.collection('iconiques').get()
let touched = 0, checked = 0
for (const doc of snap.docs) {
  const ico = doc.data()
  const images = ico.images || []
  if (!images.length) continue
  const next = []
  let changed = false
  for (const url of images) {
    checked++
    try {
      const r = await fetch(url)
      if (!r.ok) { next.push(url); continue }
      const fixed = await debander(Buffer.from(await r.arrayBuffer()))
      if (!fixed) { next.push(url); continue }
      console.log(`  ${ico.slug} — bandes`, fixed.bandes)
      next.push(DRY ? url : await upload(fixed.buffer))
      changed = true
      touched++
    } catch (e) {
      console.warn('  erreur', url, e.message)
      next.push(url)
    }
  }
  if (changed && !DRY) await doc.ref.update({ images: next })
}
console.log(`\n${checked} images vérifiées, ${touched} corrigées${DRY ? ' (dry-run)' : ''}`)
