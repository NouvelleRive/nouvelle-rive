// Pour chaque iconique (vintage + upcy) qui a une vidéo, met cette vidéo
// (la première) sur le champ `videoUrl` de tous les produits matchés
// via le même algorithme que IconiquesView (trigramme + categorieRecherche + marque + categoriesIn + materialContient).
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sa = JSON.parse(readFileSync(resolve(__dirname, 'firebase-service-account.json'), 'utf8'))
initializeApp({ credential: cert(sa) })
const db = getFirestore()

const norm = (s) =>
  (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’\-_.\s]+/g, '')

// Marques de luxe (copie depuis src/lib/admin/helpers — synchro à maintenir)
const LUXURY_BRANDS = [
  'chanel','hermès','hermes','dior','louis vuitton','gucci','prada','saint laurent','ysl',
  'fendi','givenchy','versace','balenciaga','celine','céline','bottega veneta','chloé','chloe',
  'loewe','valentino','burberry','miu miu','margiela','jacquemus','isabel marant','tom ford',
  'mugler','jean paul gaultier','jpg','courrèges','courreges','paco rabanne','rabanne',
  'comme des garçons','comme des garcons','cdg','rick owens','alexander mcqueen','mcqueen',
  'lanvin','balmain','moncler','off-white',
]

// 1) Charge tous les iconiques avec vidéos
const iconSnap = await db.collection('iconiques').get()
const iconiques = []
iconSnap.forEach((d) => {
  const x = d.data()
  if (!Array.isArray(x.videos) || x.videos.length === 0) return
  iconiques.push({
    id: d.id,
    nom: x.nom,
    videos: x.videos,
    videoUrl: x.videos[0],
    categorieRecherche: x.categorieRecherche || '',
    marque: x.marque || '',
    chineuseTrigrammes: x.chineuseTrigrammes || [],
    categoriesIn: x.categoriesIn || [],
    materialContient: x.materialContient || '',
  })
})
console.log(`Iconiques avec vidéo : ${iconiques.length}`)

// 2) Charge tous les produits actifs (non vendus, en stock)
const produitsSnap = await db.collection('produits').where('vendu', '==', false).get()
const allProduits = produitsSnap.docs
  .map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))
  .filter((p) => (p.quantite ?? 1) > 0 && p.statut !== 'retour' && p.statut !== 'supprime' && p.hidden !== true)
console.log(`Produits actifs : ${allProduits.length}`)

// 3) Pour chaque iconique, calcule les produits matchés et update videoUrl
let totalUpdated = 0
const conflictsBySku = {} // sku → [iconiques]
for (const item of iconiques) {
  const needleNom = norm(item.categorieRecherche)
  const needleMarque = norm(item.marque)
  const needleMarqueRaw = item.marque.toLowerCase().trim()
  const needleMaterial = norm(item.materialContient)
  const trigs = item.chineuseTrigrammes.map((t) => t.toUpperCase())
  const catsIn = item.categoriesIn.map((c) => norm(c))

  if (!needleNom && !needleMarque && !needleMaterial && trigs.length === 0 && catsIn.length === 0) {
    console.log(`  ⏭  ${item.id} : pas de critère, skip`)
    continue
  }

  const matched = allProduits.filter((p) => {
    const nom = norm(p.nom || '')
    const marque = norm(p.marque || '')
    const cat = typeof p.categorie === 'object' ? norm(p.categorie?.label || '') : norm(p.categorie || '')
    const material = norm(p.material || '')
    const trigramme = (p.trigramme || '').toUpperCase()

    if (needleNom && !nom.includes(needleNom) && !cat.includes(needleNom)) return false
    if (needleMarque) {
      if (needleMarqueRaw === 'luxe') {
        if (!LUXURY_BRANDS.some((b) => marque.includes(norm(b)))) return false
      } else {
        if (!marque.includes(needleMarque)) return false
      }
    }
    if (trigs.length > 0 && !trigs.includes(trigramme)) return false
    if (catsIn.length > 0 && !catsIn.some((c) => cat.includes(c))) return false
    if (needleMaterial && !material.includes(needleMaterial)) return false
    return true
  })

  let updated = 0
  for (const p of matched) {
    if (p.videoUrl === item.videoUrl) continue
    if (p.videoUrl && p.videoUrl !== item.videoUrl) {
      conflictsBySku[p.id] = (conflictsBySku[p.id] || []).concat([item.id])
    }
    await p.ref.update({ videoUrl: item.videoUrl })
    updated++
  }
  totalUpdated += updated
  console.log(`  ✓ ${item.id} : ${matched.length} produits matchés, ${updated} updated`)
}

console.log(`\nTotal produits updated : ${totalUpdated}`)
const conflicts = Object.entries(conflictsBySku)
if (conflicts.length > 0) {
  console.log(`\n⚠ Conflits (produit matché par plusieurs iconiques) : ${conflicts.length}`)
  conflicts.slice(0, 10).forEach(([sku, list]) => console.log(`  ${sku} : ${list.join(', ')}`))
}
