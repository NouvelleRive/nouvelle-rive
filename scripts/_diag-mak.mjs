// État des lunettes MAKI : reçues, marque, sur eBay ou non.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })

if (!getApps().length) {
  initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  })})
}

const db = getFirestore()
const snap = await db.collection('produits').where('trigramme', '==', 'MAK').get()

const rows = []
for (const d of snap.docs) {
  const p = d.data()
  const hasImage = (Array.isArray(p.imageUrls) && p.imageUrls.length > 0) || p.imageUrl
  rows.push({
    sku: p.sku,
    marque: p.marque || '(vide)',
    ebay: p.ebayListingId || null,
    recu: p.recu,
    vendu: p.vendu === true,
    qte: p.quantite ?? 1,
    img: !!hasImage,
    statut: p.statut || '',
  })
}
rows.sort((a, b) => a.sku.localeCompare(b.sku, 'fr', { numeric: true }))

console.log(`${rows.length} produits MAK\n`)
for (const r of rows) {
  const flags = []
  if (r.recu === false) flags.push('PAS REÇU')
  if (r.vendu) flags.push('vendu')
  if (r.qte <= 0) flags.push('stock-0')
  if (!r.img) flags.push('no-image')
  if (r.statut) flags.push(r.statut)
  console.log(
    `${r.ebay ? '✅' : '⬜'} ${r.sku.padEnd(8)} ${r.marque.padEnd(22)} ${r.ebay || ''}${flags.length ? '  [' + flags.join(', ') + ']' : ''}`
  )
}
console.log(`\nSur eBay : ${rows.filter(r => r.ebay).length} / ${rows.length}`)
