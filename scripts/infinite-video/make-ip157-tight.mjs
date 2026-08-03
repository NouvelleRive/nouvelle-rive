import sharp from 'sharp'
import { homedir } from 'os'
import { join } from 'path'

const SRC = join(homedir(), 'Desktop', 'IP157.png')
const OUT = '/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad/ip157-tight.png'

const img = sharp(SRC)
const { width, height } = await img.metadata()
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
const ch = info.channels
// on isole le pin par la SATURATION (rouge/or saturés vs gris désaturé)
const SAT = 45
let minX = width, minY = height, maxX = 0, maxY = 0
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * ch
    const r = data[i], g = data[i + 1], bl = data[i + 2]
    const sat = Math.max(r, g, bl) - Math.min(r, g, bl)
    if (sat > SAT) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  }
}
// carré centré sur le pin, avec marge -> pin à ~58% (taille normale, pas de mega-zoom)
const pinW = maxX - minX + 1, pinH = maxY - minY + 1
const FILL = 0.58
let side = Math.round(Math.max(pinW, pinH) / FILL)
side = Math.min(side, width, height)
const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
let left = Math.round(cx - side / 2), top = Math.round(cy - side / 2)
left = Math.max(0, Math.min(left, width - side))
top = Math.max(0, Math.min(top, height - side))
await sharp(SRC).extract({ left, top, width: side, height: side }).png().toFile(OUT)
console.log(`✓ ip157 carré ${side}x${side} (pin ~58%, marge égale, fond gris d'origine)`)
