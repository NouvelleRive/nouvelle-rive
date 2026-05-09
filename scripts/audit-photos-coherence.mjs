// Audit : produits dont imageUrls contient des URLs absentes des champs photos.*
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const snap = await db.collection('produits').get()
console.log(`${snap.size} produits scannés\n`)

const buckets = { faceOnModel: [], dosOnModel: [], dos: [], face: [] }

for (const d of snap.docs) {
  const p = d.data()
  if (!Array.isArray(p.imageUrls)) continue
  const ph = p.photos || {}
  const knownUrls = new Set([
    ph.face, ph.faceOnModel, ph.dos, ph.dosOnModel,
    ...(ph.details || []), ...(ph.faceOriginal ? [ph.faceOriginal] : []), ...(ph.dosOriginal ? [ph.dosOriginal] : []),
  ].filter(Boolean))

  for (const u of p.imageUrls) {
    if (typeof u !== 'string') continue
    if (knownUrls.has(u)) continue
    if (/\/on-model[\/_-]/i.test(u) && !ph.faceOnModel) buckets.faceOnModel.push({ id: d.id, sku: p.sku, u })
    else if (/\/on-model[\/_-]/i.test(u) && !ph.dosOnModel && ph.faceOnModel) buckets.dosOnModel.push({ id: d.id, sku: p.sku, u })
    // patterns face / dos non détourés (bunny CDN ou autre) absents → harder à détecter sans nom canonique
  }
}

console.log(`📷 imageUrls a une photo portée mais photos.faceOnModel absent : ${buckets.faceOnModel.length}`)
console.log(`📷 imageUrls a une 2e photo portée mais photos.dosOnModel absent : ${buckets.dosOnModel.length}`)
buckets.dosOnModel.slice(0, 10).forEach(x => console.log(`   ${x.sku || x.id}: ${x.u}`))

// Compter aussi les produits qui ont photos.faceOnModel mais pas dans imageUrls (= photo orpheline côté front)
let nbOrphan = 0
for (const d of snap.docs) {
  const p = d.data()
  const u = p.photos?.faceOnModel
  if (!u) continue
  if (!Array.isArray(p.imageUrls) || !p.imageUrls.includes(u)) nbOrphan++
}
console.log(`📷 photos.faceOnModel défini mais URL absente de imageUrls (photo invisible côté site) : ${nbOrphan}`)
process.exit(0)
