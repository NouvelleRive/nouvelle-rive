import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const SLUG = 'blazer-tweed'

// Insère à ordre=7, juste avant "Blazers de Luxe 80s" (qui passe à 8). Décale tout le reste.
const snap = await db.collection('iconiques').get()
const toShift = snap.docs.filter(d => {
  const x = d.data()
  return (x.type || 'vintage') === 'vintage' && (x.ordre || 0) >= 7
})

const batch = db.batch()
for (const d of toShift) {
  batch.update(d.ref, { ordre: (d.data().ordre || 0) + 1 })
}

const ref = db.collection('iconiques').doc(SLUG)
const exists = (await ref.get()).exists
if (exists) {
  console.log(`⚠️  Doc ${SLUG} existe déjà — abort.`)
  process.exit(1)
}

batch.set(ref, {
  slug: SLUG,
  nom: 'Blazers Tweed',
  nomEn: 'Tweed Blazers',
  dateCreation: '1954',
  histoire: "En 1924, Gabrielle Chanel s'inspire des costumes de son amant le duc de Westminster et adopte le tweed écossais — un tissu jusque-là réservé aux gentlemen. Trente ans plus tard, en 1954 lors de son retour à la mode, elle dessine la veste en tweed qui deviendra le symbole absolu de la maison : coupe droite, quatre poches, galons contrastés et boutons signés. Aujourd'hui, les modèles vintage des années 80–90 (Chanel, mais aussi Dior, Lanvin, Carven) trouvent une seconde vie chez les collectionneuses.",
  histoireEn: "In 1924, Gabrielle Chanel was inspired by the suits of her lover the Duke of Westminster and adopted Scottish tweed — a fabric until then reserved for gentlemen. Thirty years later, when she returned to fashion in 1954, she designed the tweed jacket that would become the ultimate symbol of the house: straight cut, four pockets, contrasting trims and signature buttons. Today, vintage 80s–90s pieces (Chanel, but also Dior, Lanvin, Carven) find a second life among collectors.",
  pourquoiMust: 'La pièce qui transforme un jean blanc en tenue de gala',
  pourquoiMustEn: 'The piece that turns white jeans into a gala outfit',
  valeurNeuf: 4500,
  tendancePrix: 'monte',
  categorieRecherche: 'tweed',
  categoriesIn: ['veste'],
  marque: '',
  chineuseTrigrammes: [],
  materialContient: '',
  images: [],
  videos: [],
  ordre: 7,
  type: 'vintage',
  displayOnWebsite: true,
  soldOut: false,
})

await batch.commit()
console.log(`✅ Iconique ${SLUG} créé à ordre=7. ${toShift.length} iconiques décalés (+1).`)
process.exit(0)
