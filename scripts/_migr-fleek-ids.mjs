// Renomme les pièces d'id `fleek_…` vers leur SKU (URL publique = SKU).
// L'ancien id est gardé dans achatRef (anti-doublon re-import).
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') }) })
const db = getFirestore()
const refs = (await db.collection('produits').listDocuments()).filter(r => r.id.startsWith('fleek_'))
const map = new Map()
for (const ref of refs) {
  const d = await ref.get(); const sku = d.data().sku
  if (!/^[A-Z]{2,10}\d+$/.test(sku || '')) { console.log('skip', d.id, sku); continue }
  if ((await ref.listCollections()).length) { console.log('skip subcoll', d.id); continue }
  const ventes = await db.collection('ventes').where('produitId','==',d.id).get()
  await db.runTransaction(async tx => {
    const neu = db.collection('produits').doc(sku)
    if ((await tx.get(neu)).exists) throw new Error('collision ' + sku)
    tx.create(neu, { ...d.data(), achatRef: d.id })
    ventes.docs.forEach(v => tx.update(v.ref, { produitId: sku }))
    tx.delete(d.ref)
  })
  map.set(d.id, sku)
}
console.log('migrés', map.size)
// igWeekly : candidates[].productId / boutiqueUrl + chosenProductId
for (const d of (await db.collection('igWeekly').get()).docs) {
  const x = d.data(); let ch = false
  const candidates = (x.candidates || []).map(c => { const s = map.get(c.productId); if (!s) return c; ch = true; return { ...c, productId: s, ...(c.boutiqueUrl ? { boutiqueUrl: c.boutiqueUrl.replace(c.productId, s) } : {}) } })
  const upd = { candidates }
  if (map.has(x.chosenProductId)) { upd.chosenProductId = map.get(x.chosenProductId); ch = true }
  if (ch) { await d.ref.update(upd); console.log('igWeekly', d.id) }
}
// sitemap cache
const sref = db.doc('_meta/sitemap-cache'); const sd = (await sref.get()).data()
let n = 0; const paths = sd.paths.map(p => { const m = p.match(/-(fleek_\d+_\d+_\d+)$/); if (!m || !map.has(m[1])) return p; n++; return p.slice(0, -m[1].length) + map.get(m[1]) })
await sref.update({ paths }); console.log('sitemap', n, 'reste fleek:', paths.filter(p => /fleek_/.test(p)).length)
