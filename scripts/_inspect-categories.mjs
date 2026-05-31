import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

function stripTrigramme(s) {
  return (s || '').replace(/^[A-Z]{2,10}\d{0,4}\s*[-–]\s*/i, '').trim()
}
function slugify(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
function getLabel(c) {
  if (typeof c === 'string') return c
  if (c && typeof c === 'object' && 'label' in c) return c.label || ''
  return ''
}

const db = getFirestore()
const snap = await db.collection('produits').get()

const stats = new Map()
for (const d of snap.docs) {
  const p = d.data()
  if (p.statut === 'supprime' || p.statut === 'retour') continue
  if (p.vendu) continue
  if ((p.quantite ?? 1) <= 0) continue
  const raw = stripTrigramme(getLabel(p.categorie))
  const slug = slugify(raw) || '(vide)'
  const cur = stats.get(slug) || { count: 0, rawSamples: new Set() }
  cur.count += 1
  cur.rawSamples.add(raw)
  stats.set(slug, cur)
}

const rows = [...stats.entries()].sort((a, b) => b[1].count - a[1].count)
console.log(`Total catégories distinctes : ${rows.length}\n`)
console.log('URL                                          | Nb produits dispo | Labels bruts trouvés')
console.log('---')
for (const [slug, { count, rawSamples }] of rows) {
  const samples = [...rawSamples].slice(0, 3).join(' | ')
  console.log(`/${slug.padEnd(43)} | ${String(count).padStart(17)} | ${samples}`)
}
process.exit(0)
