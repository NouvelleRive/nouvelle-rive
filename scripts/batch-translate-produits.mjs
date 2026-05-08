// Traduit en batch les ~190 produits restants via Claude Haiku.
// - Lit scripts/produits-need-translation.json
// - Appelle Claude par batchs de 10 produits
// - Écrit nomEn + descriptionEn dans Firestore + nettoie la description FR si elle contenait du EN
import Anthropic from '@anthropic-ai/sdk'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// Charge .env.local manuellement (Node n'a pas de support natif)
const envPath = resolve(projectRoot, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, 'firebase-service-account.json'), 'utf8')
)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const items = JSON.parse(
  readFileSync(resolve(__dirname, 'produits-need-translation.json'), 'utf8')
)

console.log(`${items.length} produits à traduire`)

const SYSTEM = `You are a professional FR→EN translator for a Parisian vintage clothing & upcycled jewelry boutique.
Translate the product names and descriptions from French to English with these rules:
- Keep brand names exactly as-is (Louis Vuitton, Dior, Chanel, Kenzo, Courrèges, Gucci, Roberto Cavalli, Versus, Vanessa Bruno, Achillea, Manigance, Derhy, Replay, Ralph Lauren, Jean Paul Gaultier, INES PINEAU, Archive's, Nouvelle Rive, NOUVELLE RIVE, Y2K, Big E, Marais, Paris, etc.).
- Keep SKU codes (e.g., "EQU65 - ", "IP117 - ") at the start of \`nom\` exactly.
- Keep proper nouns and material brand names (Swarovski, Zippo, Courrèges rivet, RATP, Dipoxy, Époxy → Epoxy).
- Use natural fashion English: "Acier inoxydable" → "Stainless steel", "Laiton doré à l'or fin 24K" → "24K gold-plated brass", "RÉSISTE À L'EAU" → "WATER-RESISTANT", "FERMOIR" → "CLASP", "ANNEAUX DE JONCTION" → "JUMP RINGS", "Pin's upcyclé" → "Upcycled pin", "PENDENTIF" → "PENDANT", "CRÉOLE" → "HOOP", "PAMPILLE" → "TASSEL", "MAILLON" → "LINK".
- Keep the same line breaks and formatting.
- Keep numerical values & units identical (mm, g, etc.).
- "upcyclé" → "upcycled".
- Output strict JSON with the exact same shape as input. Do NOT add any commentary or markdown.`

const BATCH_SIZE = 8

let writeBatch = db.batch()
let pendingWrites = 0
let totalWritten = 0
const errors = []

const commit = async () => {
  if (pendingWrites === 0) return
  await writeBatch.commit()
  console.log(`  → ${pendingWrites} écrits Firestore`)
  totalWritten += pendingWrites
  writeBatch = db.batch()
  pendingWrites = 0
}

for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE)
  const userMsg = `Translate this JSON array. Return strict JSON of the form [{"id": "...", "nomEn": "...", "descriptionEn": "..."}].

${JSON.stringify(batch.map(b => ({ id: b.id, nom: b.nom, description: b.description, marque: b.marque })), null, 2)}`

  console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(items.length / BATCH_SIZE)} (${batch.length} produits)`)

  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    })

    const text = resp.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')

    // Strip markdown si Claude en met
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    const translated = JSON.parse(cleaned)

    for (const t of translated) {
      const update = {}
      if (t.nomEn) update.nomEn = t.nomEn
      if (t.descriptionEn) update.descriptionEn = t.descriptionEn
      if (Object.keys(update).length === 0) continue
      writeBatch.update(db.collection('produits').doc(t.id), update)
      pendingWrites++
      if (pendingWrites >= 400) await commit()
    }
  } catch (e) {
    console.error(`  ✗ Erreur batch ${i}: ${e.message}`)
    errors.push({ batch: i, msg: e.message })
  }
}

await commit()

console.log('─'.repeat(60))
console.log(`Total écrits : ${totalWritten}`)
console.log(`Erreurs : ${errors.length}`)
if (errors.length) console.log(JSON.stringify(errors, null, 2))
