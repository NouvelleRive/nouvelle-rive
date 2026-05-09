import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

// État cible (vintage) :
//   1 trench-burberry, 2 timeless-chanel, 3 baguette-fendi, 4 lunettes-chanel,
//   5 carre-hermes [NEW],
//   6 levis-501, 7 veste-jean, 8 blazer-tweed, 9 blazer-luxe-80s,
//   10 escarpins-cuir, 11 boucles-80s-dorees,
//   12 broches [NEW],
//   13 bijoux-xxl [NEW],
//   14 fourrure-vintage, 15 revenge-dress

// ordre + renommage avec article défini ("Le/La/Les" / "The")
const TARGET = {
  'trench-burberry':     { ordre: 1,  nom: 'Le Trench Burberry',          nomEn: 'The Burberry Trench' },
  'timeless-chanel':     { ordre: 2,  nom: 'Le Sac Chanel',                nomEn: 'The Chanel Bag' },
  'baguette-fendi':      { ordre: 3,  nom: 'La Baguette Fendi',            nomEn: 'The Fendi Baguette' },
  'lunettes-chanel':     { ordre: 4,  nom: 'Les Lunettes Chanel',          nomEn: 'The Chanel Sunglasses' },
  'levis-501':           { ordre: 6,  nom: "Le Jean Levi's",               nomEn: "The Levi's Jeans" },
  'veste-jean':          { ordre: 7,  nom: 'La Veste en Jean',             nomEn: 'The Denim Jacket' },
  'blazer-tweed':        { ordre: 8,  nom: 'Le Blazer Tweed',              nomEn: 'The Tweed Blazer' },
  'blazer-luxe-80s':     { ordre: 9,  nom: 'Le Blazer de Luxe 80s',        nomEn: 'The 80s Luxury Blazer' },
  'escarpins-cuir':      { ordre: 10, nom: 'Les Escarpins en Cuir',        nomEn: 'The Leather Pumps' },
  'boucles-80s-dorees':  { ordre: 11, nom: "Les Boucles d'Oreilles Statement", nomEn: 'The Statement Earrings' },
  'fourrure-vintage':    { ordre: 14, nom: 'La Fourrure Vintage',          nomEn: 'The Vintage Fur' },
  'revenge-dress':       { ordre: 15, nom: 'La Revenge Dress',             nomEn: 'The Revenge Dress' },
}

const batch = db.batch()

for (const [id, fields] of Object.entries(TARGET)) {
  const ref = db.collection('iconiques').doc(id)
  const snap = await ref.get()
  if (!snap.exists) { console.error(`!!! ${id} introuvable`); process.exit(1) }
  batch.update(ref, fields)
}

// 1) carre-hermes (ordre 5)
const carreRef = db.collection('iconiques').doc('carre-hermes')
if (!(await carreRef.get()).exists) {
  batch.set(carreRef, {
    slug: 'carre-hermes',
    nom: 'Le Carré Hermès',
    nomEn: 'The Hermès Scarf',
    dateCreation: '1937',
    histoire: "En 1937, Hermès lance son premier carré 90×90 en soie : « Jeu des omnibus et dames blanches », dessiné par Robert Dumas. Imprimé sur un twill de soie issu de cocons brésiliens, plié à la main par 250 ouvriers à Lyon, le carré devient l'accessoire universel — porté à Buckingham par la reine Elizabeth, autour du cou par Grace Kelly, en bandeau par Audrey Hepburn. Aujourd'hui, les carrés vintage des années 70-90 (Brides de Gala, Cliquetis, Le Mors à la Conétable) circulent à 300-800€ chez les collectionneuses.",
    histoireEn: "In 1937, Hermès launched its first 90×90 silk square: 'Jeu des omnibus et dames blanches', designed by Robert Dumas. Printed on silk twill from Brazilian cocoons, hand-folded by 250 workers in Lyon, the carré became the universal accessory — worn at Buckingham by Queen Elizabeth, around the neck by Grace Kelly, as a headband by Audrey Hepburn. Today, vintage 70s-90s carrés (Brides de Gala, Cliquetis, Le Mors à la Conétable) trade at 300-800€ among collectors.",
    pourquoiMust: "L'accessoire qui se porte de 7 façons et traverse les générations",
    pourquoiMustEn: 'The accessory that ties seven ways and crosses generations',
    valeurNeuf: 470,
    tendancePrix: 'monte',
    categorieRecherche: 'foulard',
    categoriesIn: [],
    marque: 'Hermès',
    chineuseTrigrammes: [],
    materialContient: '',
    images: [],
    videos: [],
    ordre: 5,
    type: 'vintage',
    displayOnWebsite: true,
    soldOut: false,
  })
}

// 2) broches (ordre 12)
const brochesRef = db.collection('iconiques').doc('broches')
if (!(await brochesRef.get()).exists) {
  batch.set(brochesRef, {
    slug: 'broches',
    nom: 'Les Broches',
    nomEn: 'The Brooches',
    dateCreation: '1932',
    histoire: "En 1932, Coco Chanel présente sa première (et unique) collection de haute joaillerie « Bijoux de Diamants » : étoiles, croissants de lune, plumes — tous transformables en broches. Dans les années 80–90, les broches connaissent leur âge d'or : la femme Lacroix, Mugler, Saint Laurent en accumule sur revers de blazer, cols de chemise, sacs. Karl Lagerfeld réinvente la broche Chanel en grande étoile, en CC strassé, en camélia. Aujourd'hui, les broches vintage Chanel, Poggi, Valois s'accumulent sur une veste en jean ou un blazer noir pour signer un look.",
    histoireEn: "In 1932, Coco Chanel unveiled her first (and only) high jewelry collection 'Bijoux de Diamants': stars, crescent moons, feathers — all transformable into brooches. In the 80s–90s, brooches lived their golden age: the Lacroix, Mugler, Saint Laurent woman piled them on blazer lapels, shirt collars, bags. Karl Lagerfeld reinvented the Chanel brooch as a giant star, a rhinestone CC, a camellia. Today, vintage Chanel, Poggi, Valois brooches stack on a denim jacket or black blazer to make a look.",
    pourquoiMust: 'Le détail qui transforme une veste basique en pièce de couture',
    pourquoiMustEn: 'The detail that turns a basic jacket into couture',
    valeurNeuf: 350,
    tendancePrix: 'monte',
    categorieRecherche: 'broche',
    categoriesIn: [],
    marque: '',
    chineuseTrigrammes: [],
    materialContient: '',
    images: [],
    videos: [],
    ordre: 12,
    type: 'vintage',
    displayOnWebsite: true,
    soldOut: false,
  })
}

// 3) bijoux-xxl (ordre 13)
const bijouxRef = db.collection('iconiques').doc('bijoux-xxl')
if (!(await bijouxRef.get()).exists) {
  batch.set(bijouxRef, {
    slug: 'bijoux-xxl',
    nom: 'Les Bijoux XXL',
    nomEn: 'The XXL Jewelry',
    dateCreation: '1985',
    histoire: "Dans les années 80, le bijou se libère et grossit : Karl Lagerfeld empile les sautoirs Chanel, Christian Lacroix multiplie les croix baroques, Yves Saint Laurent accumule les manchettes Maison Goossens, Thierry Mugler gante ses femmes de bracelets-armures. Le bijou costume devient une déclaration : maillons gourmette XXL, chaînes ras-de-cou multi-rangs, bagues chevalières démesurées, boucles d'oreilles clip qui frôlent l'épaule. Aujourd'hui, les pièces vintage signées Chanel, Lacroix, YSL, Givenchy, Mugler s'arrachent en brocante pour leur volume théâtral.",
    histoireEn: "In the 80s, jewelry broke free and grew bigger: Karl Lagerfeld stacked Chanel sautoirs, Christian Lacroix layered baroque crosses, Yves Saint Laurent piled Maison Goossens cuffs, Thierry Mugler armored his women in bracelet-armor. Costume jewelry became a statement: XXL curb-link chains, multi-row chokers, oversized signet rings, clip earrings grazing the shoulder. Today, vintage Chanel, Lacroix, YSL, Givenchy, Mugler pieces are snapped up at flea markets for their theatrical volume.",
    pourquoiMust: 'Le bijou qui se voit avant la robe',
    pourquoiMustEn: 'The jewelry that gets noticed before the dress',
    valeurNeuf: 800,
    tendancePrix: 'monte',
    categorieRecherche: 'xxl',
    categoriesIn: [],
    marque: '',
    chineuseTrigrammes: [],
    materialContient: '',
    images: [],
    videos: [],
    ordre: 13,
    type: 'vintage',
    displayOnWebsite: true,
    soldOut: false,
  })
}

await batch.commit()
console.log('✅ carre-hermes (5) + broches (12) + bijoux-xxl (13) créés. Ordres existants ajustés.')
process.exit(0)
