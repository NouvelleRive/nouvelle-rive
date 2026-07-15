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

const today = new Date()
const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)
const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
console.log(`Toutes les ventes du ${start.toLocaleDateString('fr-FR')}`)

const snap = await db.collection('ventes')
  .where('dateVente', '>=', start)
  .where('dateVente', '<=', end)
  .get()

const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  .sort((a, b) => (b.dateVente?.toDate?.()?.getTime?.() || 0) - (a.dateVente?.toDate?.()?.getTime?.() || 0))

console.log(`\n${rows.length} vente(s) au total aujourd'hui`)
console.log(`\n--- Ventes SANS SKU ---`)
for (const v of rows.filter(v => !v.sku)) {
  const dv = v.dateVente?.toDate?.()
  console.log(`  [${dv?.toLocaleTimeString('fr-FR')}] "${v.nom || v.remarque || v.nomSquare || '(sans nom)'}" — ${v.prixVenteReel}€ — source=${v.source} — trigramme=${v.trigramme || '?'} — attribue=${v.attribue}`)
}

console.log(`\n--- Ventes AVEC SKU ---`)
for (const v of rows.filter(v => v.sku)) {
  const dv = v.dateVente?.toDate?.()
  console.log(`  [${dv?.toLocaleTimeString('fr-FR')}] ${v.sku} — "${v.nom || v.remarque}" — ${v.prixVenteReel}€ — source=${v.source} — attribue=${v.attribue}`)
}

process.exit(0)
