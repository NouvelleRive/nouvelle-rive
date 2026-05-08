// Seed la collection `iconiques-upcy` avec 12 pièces iconiques upcy.
// Chaque entrée pointe vers les produits en stock via chineuseTrigrammes + categorieRecherche,
// et utilise une image hero (produit en stock ou photo chineuse en fallback).
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, 'firebase-service-account.json'), 'utf8')
)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const ICONIQUES = [
  {
    id: 'collier-montre-ines-pineau',
    ordre: 1,
    nom: 'Le Collier Montre',
    nomEn: 'The Watch Necklace',
    pourquoiMust:
      "Une montre vintage qui devient bijou — le temps s'arrête au cou",
    pourquoiMustEn:
      'A vintage watch turned into jewelry — time stops at the neck',
    histoire:
      "Inès Pineau récupère des montres anciennes — Guess, ovales argent, ornements cœur — et les transforme en colliers statement. Chaque pièce est unique : le cadran fonctionne parfois encore, parfois s'arrête sur une heure choisie. Un objet du passé qui retrouve une seconde vie au creux du décolleté.",
    histoireEn:
      'Inès Pineau salvages vintage watches — Guess, oval silver, heart-shaped — and turns them into statement necklaces. Each piece is one of a kind: the dial sometimes still works, sometimes stops on a chosen hour. An object from the past finds a second life at the neckline.',
    images: [
      'https://nouvellerive.b-cdn.net/produits/Fca5wYSB2QCSzjkL6WMw_img0_1770044126781.png',
    ],
    chineuseTrigrammes: ['IP'],
    categorieRecherche: 'montre',
  },
  {
    id: 'top-ana-digger-sister',
    ordre: 2,
    nom: 'Le Top Ana',
    nomEn: 'The Ana Top',
    pourquoiMust:
      'Le patchwork upcyclé porté par toutes les créatrices parisiennes',
    pourquoiMustEn:
      'The upcycled patchwork top worn by every Paris designer',
    histoire:
      "Digger Sister taille ses tops dans des chutes textiles dormantes : chemises retravaillées, patchworks de tissus chinés, coupes ajustées qui sculptent la silhouette. Chaque exemplaire est unique — c'est l'essence même du upcycling. Pensé et cousu à Paris, dans l'atelier de Nejma.",
    histoireEn:
      "Digger Sister cuts her tops from dormant textile scraps: reworked shirts, patchworks of sourced fabrics, fitted cuts that sculpt the silhouette. Every piece is one of a kind — that's the very essence of upcycling. Designed and sewn in Paris, in Nejma's atelier.",
    images: [
      'https://nouvellerive.b-cdn.net/produits/conserved_1776411119110_sh3qzk.png',
    ],
    chineuseTrigrammes: ['DISI'],
    categorieRecherche: 'top',
  },
  {
    id: 'amadora-age-paris',
    ordre: 3,
    nom: 'La Veste Amadora',
    nomEn: 'The Amadora Blazer',
    pourquoiMust:
      "L'iconique tailleur ÂGE — coupé dans des deadstocks de Maisons de luxe",
    pourquoiMustEn:
      'The iconic ÂGE suit — cut from deadstock fabrics of luxury houses',
    histoire:
      "Eva et Mégane fondent ÂGE Paris en 2021 avec une obsession : réinventer le tailleur. Leur Amadora — coupe nette, épaules structurées — est taillée dans des rouleaux de deadstock chinés chez Christian Dior et Emmanuelle Khanh. Cousue à Paris par des couturiers issus des grandes maisons, elle traverse les saisons avec l'élégance silencieuse des pièces faites pour durer.",
    histoireEn:
      'Eva and Mégane founded ÂGE Paris in 2021 with one obsession: reinventing the suit. Their Amadora — clean cut, structured shoulders — is tailored from deadstock rolls sourced at Christian Dior and Emmanuelle Khanh. Sewn in Paris by tailors from major fashion houses, it crosses seasons with the silent elegance of pieces built to last.',
    images: [
      'https://nouvellerive.b-cdn.net/produits/formatted_1778235701992_0spqqy.png',
    ],
    chineuseTrigrammes: ['AGE'],
    categorieRecherche: 'amadora',
  },
  {
    id: 'set-ertha-digger-sister',
    ordre: 4,
    nom: 'Le Set Ertha',
    nomEn: 'The Ertha Set',
    pourquoiMust:
      'Le total denim upcyclé — veste + pantalon coordonnés, en éditions micro',
    pourquoiMustEn:
      'The upcycled total denim look — matching jacket + trousers, micro-edition',
    histoire:
      "Le Set Ertha est l'une des signatures Digger Sister : veste ajustée et pantalon coupe droite, taillés dans des denims dormants et assemblés en éditions ultra-limitées. Bleu profond ou gris délavé, chaque set est unique. Cousu main dans l'atelier parisien de Nejma — pour un total look qui assume sa filiation avec le workwear vintage.",
    histoireEn:
      "The Ertha Set is one of Digger Sister's signatures: fitted jacket and straight-cut trousers, cut from dormant denims and assembled in ultra-limited editions. Deep blue or washed grey, every set is unique. Hand-sewn in Nejma's Paris atelier — for a total look that owns its kinship with vintage workwear.",
    images: [
      'https://nouvellerive.b-cdn.net/produits/formatted_1774643763850_kdmbb9.png',
    ],
    chineuseTrigrammes: ['DISI'],
    categorieRecherche: 'ertha',
  },
  {
    id: 'collier-torque-ines-pineau',
    ordre: 5,
    nom: 'Le Collier Torque',
    nomEn: 'The Torque Necklace',
    pourquoiMust:
      'Le torque sculptural — animaux totémiques, métal massif, présence affirmée',
    pourquoiMustEn:
      'The sculptural torque — totem animals, solid metal, undeniable presence',
    histoire:
      "Inès Pineau réinterprète le collier torque — bijou rigide originaire de l'âge du fer — en y greffant des médaillons animaux upcyclés : cheval, chat, panthère. Métal acier inoxydable, finitions chinées dans les stocks dormants de la maroquinerie de luxe. Une pièce non-genrée, conçue pour être portée comme une armure.",
    histoireEn:
      'Inès Pineau reinterprets the torque necklace — a rigid piece of jewelry born in the Iron Age — by grafting upcycled animal medallions onto it: horse, cat, panther. Stainless steel, hardware sourced from dormant stocks of luxury leather goods. A gender-neutral piece, designed to be worn like armor.',
    images: [
      'https://nouvellerive.b-cdn.net/produits/83SUV3hV1BzWVUDfclKx_face_1770044088627.png',
    ],
    chineuseTrigrammes: ['IP'],
    categorieRecherche: 'torque',
  },
  {
    id: 'lunettes-maki-upcy',
    ordre: 6,
    nom: 'Les Lunettes Maki',
    nomEn: 'Maki Sunglasses',
    pourquoiMust:
      'Des montures de luxe d\'archive — Cartier, Chanel, YSL — restaurées une à une',
    pourquoiMustEn:
      'Archive luxury frames — Cartier, Chanel, YSL — restored one by one',
    histoire:
      "Maki Corp redonne vie aux lunettes vintage d'exception. Spécialisée dans le reconditionnement de montures iconiques — Cartier, Chanel, Dior, Céline, Chloé, YSL, Carrera — la marque allie savoir-faire artisanal et passion du vintage. Chaque paire passe par un atelier de restauration minutieux, entre Paris et Tana, pour traverser les époques avec style.",
    histoireEn:
      'Maki Corp brings exceptional vintage eyewear back to life. Specialized in refurbishing iconic frames — Cartier, Chanel, Dior, Celine, Chloé, YSL, Carrera — the brand combines artisanal know-how with a passion for vintage. Every pair goes through a meticulous restoration atelier, between Paris and Tana, to cross eras with style.',
    images: ['https://nouvellerive.b-cdn.net/chineuses/maki-corp.jpg'],
    chineuseTrigrammes: ['MAK'],
    categorieRecherche: 'lunette',
  },
  {
    id: 'chemises-digger-sister',
    ordre: 7,
    nom: 'Les Chemises',
    nomEn: 'The Shirts',
    pourquoiMust:
      'La chemise oversize retravaillée — pièce signature de Digger Sister',
    pourquoiMustEn:
      "The reworked oversize shirt — Digger Sister's signature piece",
    histoire:
      "Digger Sister revisite la chemise — May, Ajar — en jouant sur les volumes, les patchworks et les détourages. Coupes longues, tissus chinés, broderies discrètes. Chaque chemise est cousue à Paris dans l'atelier de Nejma, en éditions confidentielles. Pour une pièce de base qui n'a rien de basique.",
    histoireEn:
      "Digger Sister reinvents the shirt — May, Ajar — playing with volumes, patchworks and contoured cuts. Long silhouettes, sourced fabrics, subtle embroidery. Every shirt is sewn in Paris in Nejma's atelier, in confidential editions. For a basic that's anything but basic.",
    images: [
      'https://nouvellerive.b-cdn.net/produits/on-model/on-model_1773771206236_3krawk.png',
    ],
    chineuseTrigrammes: ['DISI'],
    categorieRecherche: 'chemise',
  },
  {
    id: 'porte-briquet-brillante',
    ordre: 8,
    nom: 'Le Porte-Briquet',
    nomEn: 'The Lighter Case',
    pourquoiMust:
      "« Burn the fascist » — l'accessoire militant à emporter partout",
    pourquoiMustEn:
      '"Burn the fascist" — the activist accessory to take everywhere',
    histoire:
      "Brillante est une marque d'accessoires créée par Ambre Desard. Ses étuis pour briquet — en TPU recyclé — portent des messages contre les oppressions, à emporter au creux du sac ou de la poche. Féminité forte, singularité queer et revendications politiques assumées : Brillante allume la mèche.",
    histoireEn:
      'Brillante is an accessories brand created by Ambre Desard. Her lighter cases — in recycled TPU — carry messages against oppressions, to slip into a bag or pocket. Bold femininity, queer singularity and unapologetic political claims: Brillante lights the fuse.',
    images: ['https://nouvellerive.b-cdn.net/chineuses/brillante.jpg'],
    chineuseTrigrammes: ['BRI'],
    categorieRecherche: 'briquet',
  },
  {
    id: 'lio-age-paris',
    ordre: 9,
    nom: 'Le Blazer Lio',
    nomEn: 'The Lio Blazer',
    pourquoiMust:
      'Le blazer ÂGE Paris — épaules sculptées, deadstock luxe, coupe parisienne',
    pourquoiMustEn:
      'The ÂGE Paris blazer — sculpted shoulders, luxury deadstock, Parisian cut',
    histoire:
      "Le Lio est l'un des blazers signatures de ÂGE Paris : tombé impeccable, épaules nettes, coupe slim. Confectionné dans des deadstocks chinés chez les Maisons de luxe — multicolores, beiges, gris — chaque pièce existe en quelques exemplaires seulement. Cousu à Paris par des tailleurs ayant travaillé pour Christian Dior ou Emmanuelle Khanh.",
    histoireEn:
      "The Lio is one of ÂGE Paris's signature blazers: impeccable drape, clean shoulders, slim cut. Crafted from deadstock sourced at luxury houses — multicolor, beige, grey — each piece exists in just a handful of copies. Sewn in Paris by tailors who have worked for Christian Dior or Emmanuelle Khanh.",
    images: [
      'https://nouvellerive.b-cdn.net/produits/on-model/on-model_1778166742307_mtgrip.png',
    ],
    chineuseTrigrammes: ['AGE'],
    categorieRecherche: 'lio',
  },
  {
    id: 'chaine-pendante-tete-dorange',
    ordre: 10,
    nom: 'La Chaîne Pendante',
    nomEn: 'The Hanging Chain',
    pourquoiMust:
      "L'upcycling pur et minimaliste — chaînes vintage régénérées en bijoux faits main",
    pourquoiMustEn:
      'Pure, minimalist upcycling — vintage chains reborn as handmade jewelry',
    histoire:
      "Tête d'Orange est une marque strasbourgeoise de bijoux upcyclés. Chaînes argent, plaqué or, gold-filled — récupérées sur d'anciennes pièces, ornées de pierres semi-précieuses et de perles d'eau douce. Portés par Fanny Sidney, Eva Danino ou Flore Benguigui, ces bijoux allient style minimaliste et conscience environnementale.",
    histoireEn:
      "Tête d'Orange is a Strasbourg-based brand of upcycled jewelry. Silver chains, gold-plated, gold-filled — salvaged from older pieces, adorned with semi-precious stones and freshwater pearls. Worn by Fanny Sidney, Eva Danino and Flore Benguigui, these pieces combine minimalist style with environmental awareness.",
    images: [
      'https://nouvellerive.b-cdn.net/produits/formatted_1770283524360_hdiutg.png',
    ],
    chineuseTrigrammes: ['TDO'],
    categorieRecherche: 'pendant',
  },
  {
    id: 'sac-strass-chronique',
    ordre: 11,
    nom: 'Le Sac Strass Chronique',
    nomEn: 'The Strass Chronique Bag',
    pourquoiMust:
      'Iconic bags handmade in Marseille — chaque sac est une pièce unique',
    pourquoiMustEn:
      'Iconic bags handmade in Marseille — every bag is a one-of-a-kind piece',
    histoire:
      "Strass Chronique est une marque de slow fashion basée à Marseille. Petites éditions et pièces uniques uniquement — sacs, jupes boule en tartan, tops en dentelle, chemises corset. Chaque pièce est fabriquée artisanalement dans la cité phocéenne, à partir de chutes textiles et de récupération. Pour celles qui cherchent des pièces statement éco-responsables, faites main avec amour.",
    histoireEn:
      'Strass Chronique is a slow fashion brand based in Marseille. Small editions and one-of-a-kind pieces only — bags, tartan bubble skirts, lace tops, corset shirts. Every piece is handcrafted in the Phocaean city, from textile scraps and salvage. For those seeking eco-conscious statement pieces, handmade with love.',
    images: ['https://nouvellerive.b-cdn.net/chineuses/strass-chronique.jpg'],
    chineuseTrigrammes: ['ST'],
    categorieRecherche: 'sac',
  },
  {
    id: 'bagues-voiture-ines-pineau',
    ordre: 12,
    nom: 'Les Bagues Voiture',
    nomEn: 'The Car Rings',
    pourquoiMust:
      "Talbot, Citroën, BMW, Renault — les emblèmes auto vintage transformés en bagues",
    pourquoiMustEn:
      'Talbot, Citroën, BMW, Renault — vintage car emblems turned into rings',
    histoire:
      "Inès Pineau récupère des emblèmes de voitures anciennes — Talbot, Citroën, Nissan, Suzuki, Subaru, Renault, BMW, Fiat — chinés sur des modèles dormants. Sertis sur corps de bague en acier inoxydable, ils deviennent des pièces non-genrées au caractère affirmé. Chaque bague est unique : impossible d'en retrouver deux identiques.",
    histoireEn:
      "Inès Pineau salvages emblems from vintage cars — Talbot, Citroën, Nissan, Suzuki, Subaru, Renault, BMW, Fiat — sourced from dormant models. Set on stainless steel ring bands, they become gender-neutral pieces with strong character. Every ring is unique: impossible to find two identical.",
    images: [
      'https://nouvellerive.b-cdn.net/produits/formatted_1770915308513_ujsbcd.png',
    ],
    chineuseTrigrammes: ['IP'],
    categorieRecherche: 'voiture',
  },
]

let written = 0
const errors = []

for (const it of ICONIQUES) {
  const { id, ...data } = it
  const fullData = {
    ...data,
    slug: id,
    displayOnWebsite: true,
    valeurNeuf: 0,
    tendancePrix: 'monte',
    dateCreation: '',
    marque: '',
    categoriesIn: [],
    materialContient: '',
  }
  try {
    await db.collection('iconiques-upcy').doc(id).set(fullData, { merge: true })
    written++
    console.log(`✓ #${data.ordre} ${id}`)
  } catch (e) {
    errors.push({ id, msg: e.message })
    console.error(`✗ ${id}: ${e.message}`)
  }
}

console.log('─'.repeat(60))
console.log(`OK: ${written}  |  Errors: ${errors.length}`)
if (errors.length) console.log(JSON.stringify(errors, null, 2))
