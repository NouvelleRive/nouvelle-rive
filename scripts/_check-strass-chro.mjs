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

const db = getFirestore()

const snap = await db.collection('iconiques').get()
const strass = snap.docs.map(d => ({ id: d.id, ...d.data() })).find(i => i.slug === 'sac-strass-chronique')

console.log('\nIconique sac strass chronique — config match :')
console.log(JSON.stringify({
  categorieRecherche: strass.categorieRecherche,
  marque: strass.marque,
  materialContient: strass.materialContient,
  chineuseTrigrammes: strass.chineuseTrigrammes,
  categoriesIn: strass.categoriesIn,
  categoriesOrder: strass.categoriesOrder,
  marquesIn: strass.marquesIn,
}, null, 2))

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’\-_.\s]+/g, '')
}

const prods = await db.collection('produits')
  .where('vendu', '==', false)
  .get()

const needleNom = norm(strass.categorieRecherche || '')
const needleMarque = norm(strass.marque || '')
const needleMaterial = norm(strass.materialContient || '')
const trigs = (strass.chineuseTrigrammes || []).map(t => t.toUpperCase())
const catsIn = (strass.categoriesIn || []).map(c => norm(c))
const marquesIn = (strass.marquesIn || []).map(m => norm(m)).filter(Boolean)

console.log('\nProduits qui matchent :')
let n = 0
for (const doc of prods.docs) {
  const p = { id: doc.id, ...doc.data() }
  if (p.statut === 'retour' || p.statut === 'supprime') continue
  if (p.hidden === true) continue
  if ((p.quantite ?? 1) <= 0) continue
  const img = p.imageUrls?.[0] || p.imageUrl || p.photos?.face
  if (!img) continue

  const nom = norm(p.nom || '')
  const marque = norm(p.marque || '')
  const cat = typeof p.categorie === 'object' ? norm(p.categorie?.label || '') : norm(p.categorie || '')
  const material = norm(p.material || '')
  const trigramme = (p.trigramme || '').toUpperCase()

  if (needleNom && !nom.includes(needleNom) && !cat.includes(needleNom)) continue
  if (needleMarque && !marque.includes(needleMarque)) continue
  if (marquesIn.length > 0 && !marquesIn.some(m => marque.includes(m))) continue
  if (trigs.length > 0 && !trigs.includes(trigramme)) continue
  if (catsIn.length > 0 && !catsIn.some(c => cat.includes(c))) continue
  if (needleMaterial && !material.includes(needleMaterial)) continue

  console.log(`  ${p.sku || p.id}  cat="${p.categorie?.label || p.categorie}"  marque="${p.marque}"  trigramme="${p.trigramme}"  nom="${p.nom}"`)
  n++
}
console.log(`\nTotal : ${n} produits`)
