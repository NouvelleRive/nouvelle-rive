import sharp from 'sharp'
import { mkdtempSync } from 'fs'
import { readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

// Rogne le fond uni (blanc OU gris) pour que l'objet touche les bords -> espacement régulier.
// Détourage "par majorité" : une ligne/colonne est du fond si >=96% de ses pixels sont
// proches de la couleur du coin haut-gauche. Robuste au bruit JPEG (un pixel parasite ne
// bloque plus le rognage, contrairement à sharp.trim). Garde-fou anti sur-crop.
// Retourne des chemins file:// locaux (dans l'ordre). En cas d'échec, garde l'image d'origine.
export async function trimToLocal(urls, threshold = 16) {
  const dir = mkdtempSync(join(tmpdir(), 'nr-trim-'))
  const out = []
  for (let i = 0; i < urls.length; i++) {
    const p = join(dir, `t${i}.png`)
    try {
      const src = urls[i]
      let buf
      if (src.startsWith('file://') || src.startsWith('/')) {
        buf = await readFile(src.replace('file://', ''))
      } else {
        const res = await fetch(src)
        buf = Buffer.from(await res.arrayBuffer())
      }
      const box = await contentBox(buf, threshold)
      const img = sharp(buf)
      if (box) {
        await img.extract(box).png().toFile(p)
      } else {
        await img.png().toFile(p)
      }
      out.push('file://' + p)
    } catch {
      out.push(urls[i])
    }
  }
  return out
}

// bbox du contenu (rogne le fond uni sur les 4 bords), ou null si rien à rogner / sur-crop
async function contentBox(buf, threshold) {
  const { data, info } = await sharp(buf).grayscale().raw().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height
  const bg = data[0]                              // couleur du coin haut-gauche (blanc ou gris)
  // fond = blanc absolu (>242) OU proche de la couleur du coin (gère coins teintés + padding blanc)
  const near = v => v > 242 || Math.abs(v - bg) <= threshold
  const rowBg = y => { let n = 0; for (let x = 0; x < W; x++) if (near(data[y * W + x])) n++; return n / W >= 0.96 }
  const colBg = x => { let n = 0; for (let y = 0; y < H; y++) if (near(data[y * W + x])) n++; return n / H >= 0.96 }
  let top = 0; while (top < H && rowBg(top)) top++
  let bot = H - 1; while (bot > top && rowBg(bot)) bot--
  let left = 0; while (left < W && colBg(left)) left++
  let right = W - 1; while (right > left && colBg(right)) right--
  const w = right - left + 1, h = bot - top + 1
  if (w <= 0 || h <= 0) return null
  if (w === W && h === H) return null              // rien à rogner
  if (w < W * 0.08 || h < H * 0.08) return null    // garde-fou anti sur-crop
  return { left, top, width: w, height: h }
}
