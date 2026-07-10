import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}
const db = getFirestore()

const FILTER_TRIG = (process.argv[2] || 'DV').toUpperCase()

const snap = await db.collection('produits').where('vendu', '==', true).get()
const rows = []
snap.docs.forEach(d => {
  const p = d.data()
  const hasIds = !!(p.variationId || p.catalogObjectId || p.itemId)
  if (!hasIds) return
  const trig = (p.trigramme || '').toUpperCase()
  if (trig !== FILTER_TRIG) return
  const dateVente = p.dateVente?.toDate?.() || null
  rows.push({
    sku: p.sku || d.id,
    dateVente: dateVente ? dateVente.toISOString().slice(0, 10) : '(?)',
    nom: (p.nom || p.Nom || '').slice(0, 70),
    prix: p.prix,
  })
})
rows.sort((a, b) => (b.dateVente || '').localeCompare(a.dateVente || ''))
console.log(`Total ${FILTER_TRIG} vendus avec IDs Square : ${rows.length}`)
console.log('date vente | SKU        | prix  | nom')
console.log('-----------|------------|-------|-----')
rows.forEach(t => console.log(`${t.dateVente} | ${(t.sku || '').padEnd(10)} | ${String(t.prix || '').padStart(5)} | ${t.nom}`))
process.exit(0)
