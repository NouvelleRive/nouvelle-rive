import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const snap = await db.collection('produits').where('achatOrderId', '==', '154621').get()
const rows = []
snap.forEach(d => {
  const x = d.data()
  rows.push({
    id: d.id,
    sku: x.sku,
    titre: x.achatTitreOriginal || x.nom || '',
    marque: x.marque || '',
    taille: x.taille || '',
    categorie: x.categorie || '',
    prix: x.prix ?? '',
    prixAchat: x.prixAchat ?? '',
    createdAt: x.createdAt?.toDate?.().toISOString() || '',
  })
})
rows.sort((a,b) => a.id.localeCompare(b.id))
for (const r of rows) {
  console.log(`${r.id.padEnd(28)} ${r.sku.padEnd(7)} ${r.createdAt.slice(0,19)} m="${r.marque}" t="${r.taille}" c="${r.categorie}" pv=${r.prix} pa=${r.prixAchat} | ${r.titre}`)
}
process.exit(0)
