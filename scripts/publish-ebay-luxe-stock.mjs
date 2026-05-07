// Liste les produits visibles sur le site qui matchent les règles `siteConfig/luxe`
// et qui ne sont pas encore sur eBay (publication "rattrapage" du stock existant).
//
// Usage :
//   node scripts/publish-ebay-luxe-stock.mjs              → dry-run (liste seulement, n'appelle pas eBay)
//   node scripts/publish-ebay-luxe-stock.mjs --apply      → publie via /api/ebay/publish-if-luxe (nécessite `npm run dev` lancé)
//   node scripts/publish-ebay-luxe-stock.mjs --apply --base=https://www.nouvellerive.com  → publie en prod
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const APPLY = process.argv.includes('--apply')
const BASE = (process.argv.find(a => a.startsWith('--base=')) || '--base=http://localhost:3000').split('=')[1]

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()

// === Reproduction stricte du filtre site + matching luxe (cf. src/lib/siteConfig.ts) ===

function matchCritere(p, critere, chineuses) {
  if (!critere.valeur) return true
  const v = critere.valeur.toLowerCase()
  switch (critere.type) {
    case 'categorie': {
      const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
      return (cat || '').toLowerCase().includes(v)
    }
    case 'nom':         return (p.nom || '').toLowerCase().includes(v)
    case 'description': return (p.description || '').toLowerCase().includes(v)
    case 'marque':      return (p.marque || '').toLowerCase().includes(v)
    case 'chineuse': {
      const c = chineuses.find(x => x.uid === critere.valeur)
      if (!c) return false
      if (p.chineur === c.email) return true
      if (p.chineurUid === c.uid) return true
      const tri = c.trigramme?.toUpperCase() || '???'
      const skuU = p.sku?.toUpperCase() || ''
      return skuU.startsWith(tri) && (skuU.length === tri.length || /\d/.test(skuU[tri.length]))
    }
    default: return false
  }
}
function matchesLuxe(p, config, chineuses) {
  if (!config.regles || config.regles.length === 0) return false
  return config.regles.some(r => r.criteres.length > 0 && r.criteres.every(c => matchCritere(p, c, chineuses)))
}
function isVisibleOnSite(p, config) {
  if (p.vendu === true) return false
  const quantite = p.quantite ?? 1
  if (quantite <= 0) return false
  if (p.statut === 'retour' || p.statut === 'supprime') return false
  if (p.recu === false) return false
  if (p.hidden === true) return false
  if (p.forceDisplay === false) return false
  const hasImage = (Array.isArray(p.imageUrls) && p.imageUrls.length > 0) || p.imageUrl
  if (!hasImage) return false
  if (config.prixMin && p.prix < config.prixMin) return false
  if (config.prixMax && p.prix > config.prixMax) return false
  if (config.joursRecents && p.createdAt) {
    const created = p.createdAt instanceof Timestamp ? p.createdAt.toDate() : new Date(p.createdAt)
    const days = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)
    if (days > config.joursRecents) return false
  }
  return true
}

// === Lecture Firestore ===
const configSnap = await db.collection('siteConfig').doc('luxe').get()
const config = configSnap.exists ? { regles: [], ...configSnap.data() } : { regles: [] }

const chineusesSnap = await db.collection('chineuse').get()
const chineuses = chineusesSnap.docs.map(d => ({ uid: d.id, ...d.data() }))

const produitsSnap = await db.collection('produits').get()
const produits = produitsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

const candidates = produits.filter(p =>
  !p.ebayListingId &&
  isVisibleOnSite(p, config) &&
  matchesLuxe(p, config, chineuses)
)

console.log(`\n📦 Produits totaux : ${produits.length}`)
console.log(`🎯 Candidats luxe à publier sur eBay : ${candidates.length}\n`)

if (candidates.length === 0) {
  console.log('Rien à publier.')
  process.exit(0)
}

console.log('SKU                  | catégorie         | marque            | prix   | titre')
console.log('---------------------|-------------------|-------------------|--------|----------------------------------')
for (const p of candidates) {
  const sku = (p.sku || p.id || '').padEnd(20).slice(0, 20)
  const cat = ((typeof p.categorie === 'object' ? p.categorie?.label : p.categorie) || '').padEnd(17).slice(0, 17)
  const mar = (p.marque || '').padEnd(17).slice(0, 17)
  const prix = `${(p.prix || 0).toFixed(0)}€`.padStart(6)
  const tit = (p.nom || '').slice(0, 50)
  console.log(`${sku} | ${cat} | ${mar} | ${prix} | ${tit}`)
}

if (!APPLY) {
  console.log(`\n💡 Dry-run. Pour publier : node scripts/publish-ebay-luxe-stock.mjs --apply`)
  console.log(`   (lance d'abord \`npm run dev\` dans un autre terminal, ou ajoute --base=https://<prod>)`)
  process.exit(0)
}

console.log(`\n🚀 Mode --apply : publication via ${BASE}/api/ebay/publish-if-luxe…\n`)
let okCount = 0, failCount = 0, noopCount = 0
for (const p of candidates) {
  const sku = p.sku || p.id
  try {
    const res = await fetch(`${BASE}/api/ebay/publish-if-luxe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: p.id }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.action === 'published') {
      console.log(`✅ ${sku} → listing ${data.listingId}`)
      okCount++
    } else if (data.action === 'noop') {
      console.log(`⏭️  ${sku} : ${data.reason}`)
      noopCount++
    } else {
      console.log(`❌ ${sku} : ${data.error || 'erreur'}`)
      failCount++
    }
  } catch (e) {
    console.log(`❌ ${sku} : ${e.message}`)
    failCount++
  }
}
console.log(`\n📊 Terminé : ${okCount} publié(s), ${noopCount} skip(s), ${failCount} échec(s)`)
process.exit(0)
