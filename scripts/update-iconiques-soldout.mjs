// Pour chaque iconique : si TOUS les produits matchés sont vendus (= aucun en stock),
// set soldOut: true. Sinon set soldOut: false. La logique de matching est la même
// que IconiquesView / propagate-videos-to-products.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’\-_.\s]+/g, '')

const LUXURY_BRANDS = ['chanel','hermès','hermes','dior','louis vuitton','gucci','prada','saint laurent','ysl','fendi','givenchy','versace','balenciaga','celine','céline','bottega veneta','chloé','chloe','loewe','valentino','burberry','miu miu','margiela','jacquemus','isabel marant','tom ford','mugler','jean paul gaultier','jpg','courrèges','courreges','paco rabanne','rabanne','comme des garçons','comme des garcons','cdg','rick owens','alexander mcqueen','mcqueen','lanvin','balmain','moncler','off-white']

const iconSnap = await db.collection('iconiques').get()
const allProdSnap = await db.collection('produits').get()
const allProds = allProdSnap.docs.map(d => ({ id: d.id, ...d.data() }))

let nbActive = 0, nbSoldOut = 0
for (const d of iconSnap.docs) {
  const item = d.data()
  const needleNom = norm(item.categorieRecherche)
  const needleMarque = norm(item.marque)
  const needleMarqueRaw = (item.marque || '').toLowerCase().trim()
  const needleMaterial = norm(item.materialContient)
  const trigs = (item.chineuseTrigrammes || []).map(t => t.toUpperCase())
  const catsIn = (item.categoriesIn || []).map(c => norm(c))

  if (!needleNom && !needleMarque && !needleMaterial && trigs.length === 0 && catsIn.length === 0) continue

  // Match (sur tous les produits, vendus inclus, pour savoir si y'en a en stock)
  const matched = allProds.filter(p => {
    if (p.statut === 'retour' || p.statut === 'supprime') return false
    if ((p.imageUrls?.length || 0) === 0 && !p.imageUrl) return false
    const nom = norm(p.nom)
    const marque = norm(p.marque)
    const cat = typeof p.categorie === 'object' ? norm(p.categorie?.label) : norm(p.categorie)
    const material = norm(p.material)
    const trigramme = (p.trigramme || '').toUpperCase()
    if (needleNom && !nom.includes(needleNom) && !cat.includes(needleNom)) return false
    if (needleMarque) {
      if (needleMarqueRaw === 'luxe') {
        if (!LUXURY_BRANDS.some(b => marque.includes(norm(b)))) return false
      } else if (!marque.includes(needleMarque)) return false
    }
    if (trigs.length > 0 && !trigs.includes(trigramme)) return false
    if (catsIn.length > 0 && !catsIn.some(c => cat.includes(c))) return false
    if (needleMaterial && !material.includes(needleMaterial)) return false
    return true
  })

  if (matched.length === 0) continue

  const inStock = matched.filter(p => !p.vendu && (p.quantite ?? 1) > 0 && p.hidden !== true && p.forceDisplay !== false)
  const shouldBeSoldOut = inStock.length === 0
  const current = item.soldOut === true

  if (shouldBeSoldOut !== current) {
    await d.ref.update({ soldOut: shouldBeSoldOut })
    console.log(`  ${d.id}: matched=${matched.length} inStock=${inStock.length} soldOut: ${current} → ${shouldBeSoldOut}`)
  }
  if (shouldBeSoldOut) nbSoldOut++; else nbActive++
}
console.log(`\n${nbActive} actifs, ${nbSoldOut} sold out`)
process.exit(0)
