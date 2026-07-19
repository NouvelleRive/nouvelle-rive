// Génère un visuel "look" inspi à partir d'une iconique (FASHN product-to-model)
import { config } from 'dotenv'
import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'
config({ path: new URL('../.env.local', import.meta.url).pathname })

const KEY = process.env.FASHN_API_KEY
const OUT = process.argv[2] || './inspi-look.png'

// Pièce héro = La chemise boyfriend (iconique vintage)
const PRODUCT = 'https://nouvellerive.b-cdn.net/produits/conserved_1784407706551_52hto7.png'

const prompt = [
  'olive-skinned woman with wavy dark brown hair',
  'standing straight, full body, professional editorial fashion shoot',
  'her legs are covered by a long ivory pleated midi skirt with fine accordion pleats falling below the knee',
  'printed silk square scarf tied over her hair as a headscarf',
  'square black sunglasses',
  'black quilted leather flap bag with gold chain on the shoulder',
  'heeled sandals',
  'plain white studio background',
].join(', ')

console.log(prompt)

const run = await fetch('https://api.fashn.ai/v1/run', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model_name: 'product-to-model',
    inputs: { product_image: PRODUCT, resolution: '1k', prompt, aspect_ratio: '1:1' },
  }),
})
if (!run.ok) throw new Error(`run ${run.status}: ${await run.text()}`)
const { id } = await run.json()

let url = null
for (let n = 0; n < 90 && !url; n++) {
  await new Promise(r => setTimeout(r, 2000))
  const st = await fetch(`https://api.fashn.ai/v1/status/${id}`, { headers: { Authorization: `Bearer ${KEY}` } })
  const d = await st.json()
  if (d.status === 'completed' && d.output?.length) url = d.output[0]
  if (d.status === 'failed') throw new Error(`failed: ${d.error?.message}`)
}
if (!url) throw new Error('timeout')

const raw = Buffer.from(await (await fetch(url)).arrayBuffer())

// FASHN renvoie un portrait posé sur un canvas 1:1 → bandes blanches sur les côtés.
// On enlève les bandes, puis on prolonge le fond studio jusqu'aux bords (aucun crop du sujet).
const trimmed = await sharp(raw).trim({ threshold: 2 }).toBuffer()
const m = await sharp(trimmed).metadata()
const side = Math.max(m.width, m.height)
const square = await sharp(trimmed)
  .extend({
    top: Math.floor((side - m.height) / 2),
    bottom: Math.ceil((side - m.height) / 2),
    left: Math.floor((side - m.width) / 2),
    right: Math.ceil((side - m.width) / 2),
    extendWith: 'copy',
  })
  .png()
  .toBuffer()

await writeFile(OUT, square)
console.log(`✅ ${OUT} — ${side}x${side}`)
