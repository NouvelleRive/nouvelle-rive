import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const SLUG = 'veste-jean'

// 1) Décale d'+1 tous les iconiques vintage avec ordre >= 6 (après "Jeans Levi's").
const snap = await db.collection('iconiques').get()
const toShift = snap.docs.filter(d => {
  const x = d.data()
  return (x.type || 'vintage') === 'vintage' && (x.ordre || 0) >= 6
})

const batch = db.batch()
for (const d of toShift) {
  batch.update(d.ref, { ordre: (d.data().ordre || 0) + 1 })
}

// 2) Crée le nouvel iconique veste en jean à ordre=6 (juste après Jeans Levi's).
const ref = db.collection('iconiques').doc(SLUG)
const exists = (await ref.get()).exists
if (exists) {
  console.log(`⚠️  Doc ${SLUG} existe déjà — abort (utilise un autre slug ou supprime d'abord).`)
  process.exit(1)
}

batch.set(ref, {
  slug: SLUG,
  nom: 'Vestes en Jean',
  nomEn: 'Denim Jackets',
  dateCreation: '1962',
  histoire: "Inventée par Levi Strauss en 1880 (Triple Pleat Blouse), la veste en jean traverse les décennies en se réinventant : Type I, II et III chez Levi's, version cintrée seventies, oversize nineties popularisée par Madonna, Rihanna et toute la scène hip-hop. Aujourd'hui, les modèles vintage des années 80–90 (Levi's, Lee, Wrangler, mais aussi Chanel et Dolce & Gabbana) s'arrachent en friperies parisiennes pour leur coupe carrée et leur denim adouci par les années.",
  histoireEn: "Invented by Levi Strauss in 1880 (Triple Pleat Blouse), the denim jacket reinvents itself across decades: Type I, II and III at Levi's, fitted seventies cut, oversized nineties silhouette popularized by Madonna, Rihanna and the entire hip-hop scene. Today, vintage 80s–90s pieces (Levi's, Lee, Wrangler, but also Chanel and Dolce & Gabbana) are snapped up in Paris vintage stores for their boxy cut and denim softened by the years.",
  pourquoiMust: 'La pièce qui se porte sur tout, du slip dress à la robe de soirée',
  pourquoiMustEn: 'The piece that goes over everything, from a slip dress to an evening gown',
  valeurNeuf: 250,
  tendancePrix: 'monte',
  categorieRecherche: 'denim',
  categoriesIn: ['veste'],
  marque: '',
  chineuseTrigrammes: [],
  materialContient: '',
  images: [],
  videos: [],
  ordre: 6,
  type: 'vintage',
  displayOnWebsite: true,
  soldOut: false,
})

await batch.commit()
console.log(`✅ Iconique ${SLUG} créé à ordre=6 (vintage). ${toShift.length} iconiques décalés (+1).`)
process.exit(0)
