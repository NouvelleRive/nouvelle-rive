// Anime une image de look en vidéo (Replicate — Kling v2.1 image-to-video)
import { config } from 'dotenv'
import { readFile, writeFile } from 'node:fs/promises'
config({ path: new URL('../.env.local', import.meta.url).pathname })

const TOK = process.env.REPLICATE_API_TOKEN
const IN = process.argv[2]
const OUT = process.argv[3] || IN.replace(/\.png$/, '.mp4')

const dataUri = `data:image/png;base64,${(await readFile(IN)).toString('base64')}`

const prompt = [
  'the model slowly turns her body toward the camera and back',
  'the silk scarf and her hair move gently',
  'subtle natural fabric movement',
  'camera stays completely static, fixed studio shot',
  'no zoom, no camera movement',
].join(', ')

const create = await fetch('https://api.replicate.com/v1/models/kwaivgi/kling-v2.1/predictions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json', Prefer: 'wait=60' },
  body: JSON.stringify({
    input: { start_image: dataUri, prompt, duration: 5, mode: 'standard' },
  }),
})
if (!create.ok) throw new Error(`create ${create.status}: ${await create.text()}`)
let pred = await create.json()

while (['starting', 'processing'].includes(pred.status)) {
  await new Promise(r => setTimeout(r, 5000))
  const r = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${TOK}` } })
  pred = await r.json()
  console.log('  ', pred.status)
}
if (pred.status !== 'succeeded') throw new Error(`${pred.status}: ${JSON.stringify(pred.error)}`)

await writeFile(OUT, Buffer.from(await (await fetch(pred.output)).arrayBuffer()))
console.log(`✅ ${OUT}`)
