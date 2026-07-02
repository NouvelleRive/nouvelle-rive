import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
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

const LUXURY = [
  'hermès','hermes','chanel','louis vuitton','lv','dior','christian dior',
  'céline','celine','yves saint laurent','ysl','saint laurent','gucci',
  'burberry','givenchy','lanvin','nina ricci','balenciaga','bottega veneta',
  'prada','fendi','valentino','loewe','cartier','van cleef','boucheron',
]
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const strip = s => String(s || '').replace(/^[A-Z]{2,10}\d{0,4}\s*[-–]\s*/i, '').trim()
const catLabel = c => typeof c === 'string' ? c : (c && typeof c === 'object' && typeof c.label === 'string' ? c.label : '')
const typeSlug = c => slug(strip(catLabel(c))) || 'piece'
const buildPath = p => {
  const type = typeSlug(p.categorie)
  const marque = slug(p.marque || '') || 'sm'
  const nom = strip(p.nom || '')
  const desc = [p.marque, nom, p.color, p.taille].filter(Boolean).join(' ')
  return `${type}/${marque}/${(slug(desc).slice(0, 80) || 'piece')}-${p.id}`
}

const luxSlugs = new Set(LUXURY.map(slug))
const snap = await db.collection('produits')
  .select('statut','vendu','quantite','prix','photos','imageUrls','imageUrl','marque','categorie','nom','color','taille')
  .get()

const paths = []
const typeSet = new Set()
const luxSet = new Set()
for (const doc of snap.docs) {
  const p = { id: doc.id, ...doc.data() }
  if (p.statut === 'supprime' || p.statut === 'retour') continue
  if (p.vendu === true) continue
  if ((p.quantite == null ? 1 : p.quantite) <= 0) continue
  if (!p.prix || p.prix <= 0) continue
  if (!(p.photos && p.photos.face) && !(p.imageUrls && p.imageUrls[0]) && !p.imageUrl) continue
  const t = typeSlug(p.categorie)
  if (t && t !== 'piece') typeSet.add(t)
  if (p.marque) {
    const bs = slug(p.marque)
    if (luxSlugs.has(bs)) luxSet.add(bs)
  }
  paths.push(buildPath(p))
}

await db.doc('_meta/sitemap-cache').set({
  paths,
  types: [...typeSet],
  luxuryBrands: [...luxSet],
  updatedAt: FieldValue.serverTimestamp(),
})

console.log(`✅ ${paths.length} produits, ${typeSet.size} types, ${luxSet.size} luxe`)
process.exit(0)
