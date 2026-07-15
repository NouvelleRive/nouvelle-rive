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
console.log(`Recherche ventes du ${start.toLocaleDateString('fr-FR')} 00:00 → 23:59`)

// 1) Ventes MAK d'aujourd'hui
const q = await db.collection('ventes')
  .where('trigramme', '==', 'MAK')
  .get()

const auj = q.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(v => {
    const dv = v.dateVente?.toDate?.()
    return dv && dv >= start && dv <= end
  })
  .sort((a, b) => (b.dateVente?.toDate?.()?.getTime?.() || 0) - (a.dateVente?.toDate?.()?.getTime?.() || 0))

console.log(`\n${auj.length} vente(s) MAK aujourd'hui :`)
for (const v of auj) {
  const dv = v.dateVente?.toDate?.()
  console.log(`  [${dv?.toISOString()}] ${v.sku || '(sku?)'} — ${v.nom || v.remarque || '(nom?)'} — ${v.prixVenteReel}€ — source=${v.source || '?'} — attribue=${v.attribue}`)
}

// 2) Chercher spécifiquement "dior" ou "lunette" ou 239€ dans tout MAK récent
console.log(`\n--- Recherche "dior"/"lunette"/239€ (30 derniers jours) ---`)
const j30 = new Date(); j30.setDate(j30.getDate() - 30)
const recent = q.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(v => v.dateVente?.toDate?.() >= j30)

const hits = recent.filter(v => {
  const txt = `${v.nom || ''} ${v.remarque || ''} ${v.sku || ''}`.toLowerCase()
  return txt.includes('dior') || txt.includes('lunette') || v.prixVenteReel === 239
})
for (const v of hits) {
  const dv = v.dateVente?.toDate?.()
  console.log(`  [${dv?.toLocaleDateString('fr-FR')} ${dv?.toLocaleTimeString('fr-FR')}] ${v.sku} — ${v.nom || v.remarque} — ${v.prixVenteReel}€ — source=${v.source} — attribue=${v.attribue}`)
}

// 3) Produits MAK avec "dior" ou "lunette" encore en stock
console.log(`\n--- Produits MAK contenant "dior"/"lunette" encore en stock ---`)
const psnap = await db.collection('produits').where('trigramme', '==', 'MAK').get()
const stock = psnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(p => !p.vendu && (p.quantite ?? 1) > 0 && p.statut !== 'supprime' && p.statut !== 'retour')
  .filter(p => {
    const txt = `${p.nom || ''} ${p.description || ''} ${p.marque || ''}`.toLowerCase()
    return txt.includes('dior') || txt.includes('lunette')
  })
for (const p of stock) {
  console.log(`  ${p.sku} — ${p.nom} — ${p.prix}€ — marque=${p.marque} — vendu=${p.vendu} — qte=${p.quantite}`)
}

process.exit(0)
