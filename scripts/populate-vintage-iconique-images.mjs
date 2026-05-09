// Peuple chaque iconique vintage avec 2-3 photos prises sur les produits qui matchent
// (même approche que les iconiques upcy : URLs Bunny des produits du catalogue).
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

// Liste blanche des marques de luxe (même logique que dans helpers.ts) — utilisé quand marque='luxe'.
// On le définit minimal ici : sera enrichi au besoin. Aucun iconique vintage ne l'utilise pour l'instant.
const LUXURY_BRANDS = ['chanel','hermès','hermes','dior','louis vuitton','gucci','prada','fendi','saint laurent','ysl','versace','givenchy','balenciaga','celine','céline','valentino','burberry','loewe','bottega','miu miu']

const norm = (s) =>
  (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’\-_.\s]+/g, '')

const NUM_IMAGES_PER_ICONIQUE = 3
const SKIP_IF_HAS_IMAGES = true // n'écrase pas un iconique qui a déjà des images

// Récupère tous les iconiques vintage
const iconSnap = await db.collection('iconiques').get()
const vintageIcons = iconSnap.docs
  .map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
  .filter(x => (x.type || 'vintage') === 'vintage')
  .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))

// Récupère tous les produits actifs (en stock, non vendus, non hidden)
const prodSnap = await db.collection('produits').where('vendu', '==', false).get()
const allProduits = prodSnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(p => p.statut !== 'retour' && p.statut !== 'supprime' && p.hidden !== true && (p.quantite ?? 1) > 0)
  .filter(p => !!(p.imageUrls?.[0] || p.imageUrl || p.photos?.face))

console.log(`${vintageIcons.length} iconiques vintage, ${allProduits.length} produits actifs.\n`)

const updates = []

for (const item of vintageIcons) {
  const existingImgs = Array.isArray(item.images) ? item.images : []
  if (SKIP_IF_HAS_IMAGES && existingImgs.length > 0) {
    console.log(`⏭️  ${item.id} a déjà ${existingImgs.length} image(s) — skip`)
    continue
  }

  const needleNom = norm(item.categorieRecherche || '')
  const needleMarque = norm(item.marque || '')
  const needleMarqueRaw = (item.marque || '').toLowerCase().trim()
  const needleMaterial = norm(item.materialContient || '')
  const trigs = (item.chineuseTrigrammes || []).map(t => t.toUpperCase())
  const catsIn = (item.categoriesIn || []).map(c => norm(c))

  if (!needleNom && !needleMarque && !needleMaterial && trigs.length === 0 && catsIn.length === 0) {
    console.log(`⚠️  ${item.id} n'a aucun filtre produit — skip`)
    continue
  }

  const matched = allProduits.filter(p => {
    const nom = norm(p.nom || p.Nom || '')
    const marque = norm(p.marque || '')
    const cat = typeof p.categorie === 'object' ? norm(p.categorie?.label || '') : norm(p.categorie || '')
    const material = norm(p.material || '')
    const trigramme = (p.trigramme || '').toUpperCase()

    if (needleNom && !nom.includes(needleNom) && !cat.includes(needleNom)) return false
    if (needleMarque) {
      if (needleMarqueRaw === 'luxe') {
        if (!LUXURY_BRANDS.some(b => marque.includes(norm(b)))) return false
      } else {
        if (!marque.includes(needleMarque)) return false
      }
    }
    if (trigs.length > 0 && !trigs.includes(trigramme)) return false
    if (catsIn.length > 0 && !catsIn.some(c => cat.includes(c))) return false
    if (needleMaterial && !material.includes(needleMaterial)) return false
    return true
  })

  if (matched.length === 0) {
    console.log(`❌ ${item.id} (${item.nom}) — 0 produit matché, photos non remplies`)
    continue
  }

  // Prend la 1ère photo de chaque produit matché jusqu'à NUM_IMAGES_PER_ICONIQUE
  const imgs = []
  for (const p of matched) {
    if (imgs.length >= NUM_IMAGES_PER_ICONIQUE) break
    const url = p.imageUrls?.[0] || p.imageUrl || p.photos?.face
    if (url && !imgs.includes(url)) imgs.push(url)
  }

  if (imgs.length === 0) {
    console.log(`❌ ${item.id} — produits matchés mais sans URL exploitable`)
    continue
  }

  console.log(`✅ ${item.id} (${item.nom}) — ${imgs.length} photo(s) sur ${matched.length} match(es)`)
  imgs.forEach((u, i) => console.log(`     [${i}] ${u}`))
  updates.push({ ref: item.ref, images: imgs })
}

if (updates.length === 0) {
  console.log('\nRien à mettre à jour.')
  process.exit(0)
}

const batch = db.batch()
for (const u of updates) batch.update(u.ref, { images: u.images })
await batch.commit()
console.log(`\n✅ ${updates.length} iconiques mis à jour.`)
process.exit(0)
