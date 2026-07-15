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

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’\-_.\s]+/g, '')
}

// 1) Lister toutes les iconiques vintage triées par ordre
const iconiquesSnap = await db.collection('iconiques').get()
const iconiques = iconiquesSnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(i => i.displayOnWebsite !== false && (i.type || 'vintage') === 'vintage')
  .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))

console.log(`\n=== ICONIQUES VINTAGE (${iconiques.length}) — triées par ordre ===`)
iconiques.forEach((i, idx) => {
  console.log(`  slot #${idx + 1} → ordre=${i.ordre} | ${i.nom} | marque="${i.marque}" | catRech="${i.categorieRecherche}" | trigs=[${(i.chineuseTrigrammes || []).join(',')}] | soldOut=${i.soldOut}`)
})

// 2) Focus Levi's — trouver l'iconique
const levisIco = iconiques.find(i => norm(i.nom).includes('levi') || norm(i.marque).includes('levi') || norm(i.categorieRecherche).includes('jean'))
console.log(`\n=== ICONIQUE LEVI'S / JEAN trouvée ? ===`)
if (levisIco) {
  console.log(levisIco)
} else {
  console.log('AUCUNE iconique Levi\'s / jean dans vintage')
  // check upcy
  const upcy = iconiquesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => norm(i.nom).includes('levi') || norm(i.marque).includes('levi'))
  console.log('Levis dans upcy ou autre type ?', upcy.map(i => ({ id: i.id, nom: i.nom, type: i.type, ordre: i.ordre, displayOnWebsite: i.displayOnWebsite })))
}

// 3) Produits Levi's dans le stock actif
console.log(`\n=== PRODUITS LEVI'S actifs (échantillon) ===`)
const psnap = await db.collection('produits').get()
const levisProduits = psnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(p =>
    p.vendu !== true &&
    (p.quantite ?? 1) > 0 &&
    p.statut !== 'retour' &&
    p.statut !== 'supprime' &&
    p.hidden !== true &&
    !!(p.imageUrls?.[0] || p.imageUrl || p.photos?.face) &&
    (norm(p.marque || '').includes('levi') || norm(p.nom || '').includes('levi'))
  )
console.log(`Total produits Levi's actifs : ${levisProduits.length}`)
levisProduits.slice(0, 5).forEach(p => {
  const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
  console.log(`  ${p.sku || p.id} — nom="${p.nom}" — marque="${p.marque}" — cat="${cat}"`)
})

// 4) Si iconique Levi's trouvée, simuler le match
if (levisIco) {
  console.log(`\n=== SIMULATION MATCH ICONIQUE LEVI'S ===`)
  const needleNom = norm(levisIco.categorieRecherche || '')
  const needleMarque = norm(levisIco.marque || '')
  const trigs = (levisIco.chineuseTrigrammes || []).map(t => t.toUpperCase())
  const catsIn = (levisIco.categoriesIn || []).map(c => norm(c))

  const matched = psnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p =>
      p.vendu !== true &&
      (p.quantite ?? 1) > 0 &&
      p.statut !== 'retour' &&
      p.statut !== 'supprime' &&
      p.hidden !== true &&
      !!(p.imageUrls?.[0] || p.imageUrl || p.photos?.face)
    )
    .filter(p => {
      const nom = norm(p.nom || '')
      const marque = norm(p.marque || '')
      const cat = typeof p.categorie === 'object' ? norm(p.categorie?.label || '') : norm(p.categorie || '')
      const trigramme = (p.trigramme || '').toUpperCase()
      if (needleNom && !nom.includes(needleNom) && !cat.includes(needleNom)) return false
      if (needleMarque && !marque.includes(needleMarque)) return false
      if (trigs.length > 0 && !trigs.includes(trigramme)) return false
      if (catsIn.length > 0 && !catsIn.some(c => cat.includes(c))) return false
      return true
    })
  console.log(`Match count: ${matched.length}`)
  matched.slice(0, 10).forEach(p => {
    const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
    console.log(`  ${p.sku || p.id} — "${p.nom}" — marque="${p.marque}" — cat="${cat}"`)
  })
}

process.exit(0)
