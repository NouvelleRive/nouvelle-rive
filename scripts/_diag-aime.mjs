import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
import zlib from 'zlib'
config({ path: new URL('../.env.local', import.meta.url).pathname })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  })
}
const db = getFirestore()

// 1. Trouver Aimé dans la collection chineuse
const chSnap = await db.collection('chineuse').get()
const aime = chSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  .filter(c => JSON.stringify(c).toLowerCase().includes('aim'))
console.log('=== CHINEUSE(S) matching "aim" ===')
for (const c of aime) console.log(`  id=${c.id} tri=${c.trigramme} nom=${c.nom || c.prenom || ''} email=${c.email || (c.emails||[]).join(',')}`)

const tris = [...new Set(aime.map(c => (c.trigramme||'').toUpperCase()).filter(Boolean))]
console.log('\nTrigramme(s):', tris)

// 2. Pièces de ce/ces trigramme(s)
for (const tri of tris) {
  const snap = await db.collection('produits').where('trigramme', '==', tri).get()
  console.log(`\n=== ${tri} : ${snap.size} pièce(s) ===`)
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.createdAt?.toMillis?.()||0) - (a.createdAt?.toMillis?.()||0))
  for (const p of rows.slice(0, 15)) {
    const cr = p.createdAt?.toDate?.()?.toISOString()?.slice(0,10) || '?'
    const dr = p.dateReception?.toDate?.()?.toISOString()?.slice(0,10) || '-'
    console.log(`  ${p.sku||p.id}  recu=${p.recu} statut=${p.statut||''} vendu=${p.vendu} qte=${p.quantite} statutRestock=${p.statutRestock||''} created=${cr} recuLe=${dr} photo=${!!(p.photos?.face||p.imageUrls?.[0]||p.imageUrl)}`)
  }
}

// 3. Etat du blob produits-all
try {
  const bucket = getStorage().bucket()
  const file = bucket.file('_cache/produits-all.json.gz')
  const [meta] = await file.getMetadata().catch(() => [null])
  const [buf] = await file.download()
  let txt; try { txt = zlib.gunzipSync(buf).toString('utf8') } catch { txt = buf.toString('utf8') }
  const json = JSON.parse(txt)
  console.log(`\n=== BLOB produits-all : ${json.length} items, updated=${meta?.updated} ===`)
  for (const tri of tris) {
    const inBlob = json.filter(it => (it.raw?.trigramme||'').toUpperCase() === tri)
    console.log(`  ${tri} dans blob: ${inBlob.length} pièce(s)`)
    for (const it of inBlob.slice(0,15)) {
      console.log(`    ${it.raw?.sku||it.id} recu=${it.raw?.recu} statut=${it.raw?.statut||''}`)
    }
  }
} catch (e) {
  console.log('\n[blob] erreur:', e.message)
}
process.exit(0)
