// Remet les images uploadées (bague voiture x3 + collier montre x3) à la FIN
// de imageUrls (au lieu du début), pour que la 1ère photo reste la vraie photo produit
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

// URLs ajoutées récemment (à déplacer à la fin)
const HERO_URLS_PATTERNS = [
  /\/iconiques\/bague-voiture-1-/,
  /\/iconiques\/bague-voiture-2-/,
  /\/iconiques\/bague-voiture-3-/,
  /\/iconiques\/collier-montre-2-/,
  /\/iconiques\/collier-montre-3-/,
  /\/produits\/collier-montre-feature-/,
]
const isHero = (u) => typeof u === 'string' && HERO_URLS_PATTERNS.some(re => re.test(u))

function reorder(imageUrls) {
  const heroes = imageUrls.filter(isHero)
  const others = imageUrls.filter(u => !isHero(u))
  if (heroes.length === 0 || others.length === 0) return null
  // Format souhaité : [vraie photo produit, ...heroes, ...autres photos produit]
  return [others[0], ...heroes, ...others.slice(1)]
}

let nb = 0
const ipSnap = await db.collection('produits').where('trigramme', '==', 'IP').get()
for (const d of ipSnap.docs) {
  const p = d.data()
  if (!Array.isArray(p.imageUrls)) continue
  const newUrls = reorder(p.imageUrls)
  if (!newUrls || JSON.stringify(newUrls) === JSON.stringify(p.imageUrls)) continue
  await d.ref.update({ imageUrls: newUrls, imageUrl: newUrls[0] })
  console.log(`  ✏️ ${p.sku || d.id}`)
  nb++
}

// LeyViw99HklsDzpnGARG est un collier zip, pas collier montre →
// retirer complètement la photo collier-montre-feature
const sp = await db.collection('produits').doc('LeyViw99HklsDzpnGARG').get()
if (sp.exists) {
  const p = sp.data()
  if (Array.isArray(p.imageUrls)) {
    const cleaned = p.imageUrls.filter(u => !/\/produits\/collier-montre-feature-/.test(u))
    if (JSON.stringify(cleaned) !== JSON.stringify(p.imageUrls)) {
      await sp.ref.update({ imageUrls: cleaned, imageUrl: cleaned[0] })
      console.log(`  ✏️ LeyViw99HklsDzpnGARG : retire collier-montre-feature`)
      nb++
    }
  }
}
console.log(`\n${nb} produit(s) ré-ordonnés`)
process.exit(0)
