// 9 carrés Hermès vintage sous chineuse Nouvelle Rive (trigramme NR).
// Usage : node scripts/add-hermes-carres-nr.mjs

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

// Chineuse Nouvelle Rive
const chSnap = await db.collection('chineuse').where('trigramme', '==', 'NR').limit(1).get()
if (chSnap.empty) { console.error('❌ Aucune chineuse avec trigramme=NR'); process.exit(1) }
const chDoc = chSnap.docs[0]
const ch = chDoc.data()
const chineurUid = ch.authUid || ch.uid || chDoc.id
const chineurEmail = ch.email || null
console.log(`→ Chineuse NR : ${ch.nom || chDoc.id}`)

// Prochain numéro NR
const prodSnap = await db.collection('produits').where('trigramme', '==', 'NR').get()
let maxNum = 0
prodSnap.forEach(d => {
  const m = (d.data().sku || '').toString().match(/^NR(\d+)$/i)
  if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n }
})
console.log(`→ Démarrage à NR${maxNum + 1}`)

const CARRES = [
  {
    modele: 'Éperon d\'Or', prix: 375,
    dessinateur: 'Henri d\'Origny', annee: '1974 (probable réédition)',
    dimensions: '≈ 90 cm (à mesurer)',
    titreFr: 'Carré Hermès « Éperon d\'Or »',
    titreEn: 'Hermès « Éperon d\'Or » Silk Scarf',
    etatFr: 'Très bon état, passé au pressing, pas de fils tirés.',
    etatEn: 'Very good condition, professionally cleaned, no pulled threads.',
    descFr: 'Classique équestre signé Henri d\'Origny. Un entrelacs d\'éperons, de mors et de boucles dorés rayonne autour d\'un médaillon central, dans une géométrie raffinée. Coloris marine, rouge, écru et or.',
    descEn: 'An equestrian classic by Henri d\'Origny. An interlace of golden spurs, bits and buckles radiates around a central medallion in a refined geometry. Navy, red, ecru and gold.',
  },
  {
    modele: 'Libres comme l\'air', prix: 420,
    dessinateur: 'Annie Faivre', annee: '2003 (jamais réédité)',
    dimensions: '≈ 90 cm (à mesurer)',
    titreFr: 'Carré Hermès « Libres comme l\'air »',
    titreEn: 'Hermès « Libres comme l\'air » Silk Scarf',
    etatFr: 'Très bon état, passé au pressing, pas de fils tirés.',
    etatEn: 'Very good condition, professionally cleaned, no pulled threads.',
    descFr: 'Pièce rare, jamais rééditée. Une multitude d\'oiseaux migrateurs — sarcelles, hérons, ibis — prennent leur envol, encadrés de frises géométriques inspirées des tapis nomades persans. Palette pastel lumineuse. Dessiné par Annie Faivre, avec son petit singe caché signature.',
    descEn: 'A rare piece, never re-issued. A multitude of migratory birds — teals, herons, ibises — take flight, framed by geometric borders inspired by Persian nomadic rugs. Luminous pastel palette. Designed by Annie Faivre, with her signature hidden monkey.',
  },
  {
    modele: 'Harnais à l\'Anglaise', prix: 375,
    dessinateur: 'Hugo Grygkar', annee: 'circa 1955',
    dimensions: '≈ 88–90 cm (à mesurer)',
    titreFr: 'Carré Hermès « Harnais à l\'Anglaise »',
    titreEn: 'Hermès « Harnais à l\'Anglaise » Silk Scarf',
    etatFr: 'Très bon état, passé au pressing, pas de fils tirés.',
    etatEn: 'Very good condition, professionally cleaned, no pulled threads.',
    descFr: 'Grand classique équestre signé Hugo Grygkar : chevaux harnachés, palefreniers et carrosse d\'apparat se déploient autour d\'un médaillon central. Coloris vifs rouge, bleu roi, blanc et or.',
    descEn: 'A great equestrian classic by Hugo Grygkar: harnessed horses, grooms and a ceremonial carriage unfold around a central medallion. Vivid red, royal blue, white and gold.',
  },
  {
    modele: 'Palefroi', prix: 320,
    dessinateur: 'Françoise de la Perrière', annee: 'vers 1962–1965',
    dimensions: '≈ 85–87 cm (vintage d\'époque, à mesurer)',
    titreFr: 'Carré Hermès « Palefroi »',
    titreEn: 'Hermès « Palefroi » Silk Scarf',
    etatFr: 'Bon état, fond légèrement jauni / patiné par le temps, passé au pressing, pas de fils tirés.',
    etatEn: 'Good condition, ground gently yellowed / mellowed with age, professionally cleaned, no pulled threads.',
    descFr: 'Authentique vintage d\'époque (format 85–87 cm, sans copyright, antérieur à 1967). Dessiné par Françoise de la Perrière, ce carré célèbre le palefroi — cheval de parade richement caparaçonné — entouré d\'un entrelacs de cordelières et de glands d\'or. Bordure bleue.',
    descEn: 'An authentic early vintage piece (85–87 cm format, no copyright, pre-1967). Designed by Françoise de la Perrière, it celebrates the palfrey — a richly caparisoned parade horse — framed by an interlace of rope cords and golden tassels. Blue border.',
  },
  {
    modele: 'Les Pivoines', prix: 375,
    dessinateur: 'Christiane Vauzelles', annee: '1977/1978 (réédité 1990, 2006)',
    dimensions: '≈ 90 cm (à mesurer)',
    titreFr: 'Carré Hermès « Les Pivoines »',
    titreEn: 'Hermès « Les Pivoines » Silk Scarf',
    etatFr: 'Très bon état, passé au pressing, pas de fils tirés.',
    etatEn: 'Very good condition, professionally cleaned, no pulled threads.',
    descFr: 'Recherché des collectionneurs. Composition florale tout en délicatesse par Christiane Vauzelles : un foisonnement de pivoines roses épanouies sur fond crème rehaussé d\'un cannage doré rayonnant. Bordure rose, palette romantique et lumineuse.',
    descEn: 'Sought-after by collectors. A delicate floral composition by Christiane Vauzelles: a profusion of blooming pink peonies on a cream ground enhanced by a radiant golden caning motif. Pink border, romantic and luminous palette.',
  },
  {
    modele: 'Colverts', prix: 555,
    dessinateur: 'Henri de Linarès (signature à vérifier)', annee: 'à confirmer',
    dimensions: '≈ 90 cm (à mesurer)',
    titreFr: 'Carré Hermès « Colverts »',
    titreEn: 'Hermès « Colverts » Silk Scarf',
    etatFr: 'Très bon état, passé au pressing, pas de fils tirés.',
    etatEn: 'Very good condition, professionally cleaned, no pulled threads.',
    descFr: 'Pièce rare et recherchée. Une nuée de canards colverts s\'envole parmi les roseaux, dans un superbe coloris ocre et or souligné de rouge sur fond noir profond. Les motifs animaliers et de chasse d\'Hermès comptent parmi les plus prisés des collectionneurs.',
    descEn: 'A rare and sought-after piece. A flight of mallard ducks rises among the reeds in a superb ochre-and-gold colourway accented with red on a deep black ground. Hermès\'s wildlife and hunting designs are among the most prized by collectors.',
  },
  {
    modele: 'Brides de Gala', prix: 249,
    dessinateur: 'Hugo Grygkar', annee: '1957 (cet exemplaire rose poudré : réédition années 1990)',
    dimensions: '≈ 90 cm (à mesurer)',
    titreFr: 'Carré Hermès « Brides de Gala »',
    titreEn: 'Hermès « Brides de Gala » Silk Scarf',
    etatFr: 'Très bon état, passé au pressing, pas de fils tirés.',
    etatEn: 'Very good condition, professionally cleaned, no pulled threads.',
    descFr: 'Le carré le plus iconique de la Maison Hermès. Dessiné par Hugo Grygkar en 1957 à partir de deux brides d\'apparat posées face à face : une composition d\'une sobriété parfaite, devenue un symbole. Coloris rose poudré et écru.',
    descEn: 'The most iconic scarf of the House of Hermès. Designed by Hugo Grygkar in 1957 from two ceremonial bridles laid face to face: a composition of perfect restraint that became an emblem. Powder pink and ecru colourway.',
  },
  {
    modele: 'Égypte', prix: 420,
    dessinateur: 'Cathy Latham', annee: 'à confirmer (c. 1970 / réédition 1985)',
    dimensions: '≈ 88–90 cm (à mesurer)',
    titreFr: 'Carré Hermès « Égypte »',
    titreEn: 'Hermès « Égypte » Silk Scarf',
    etatFr: 'À vérifier (quelques marques possibles sur le fond), passé au pressing.',
    etatEn: 'To be checked (possible light marks on the ground), professionally cleaned.',
    descFr: 'Coloris vert franc rare et thème égyptien recherché. Faucons aux ailes déployées, coiffes pharaoniques et papyrus dorés s\'organisent en rosace autour d\'un motif central, dans un riche camaïeu d\'or et de brun. Dessiné par Cathy Latham.',
    descEn: 'A rare bold green colourway and sought-after Egyptian theme. Falcons with outstretched wings, pharaonic headdresses and golden papyrus arranged in a rosette around a central motif, in a rich gold-and-brown palette. Designed by Cathy Latham.',
  },
  {
    modele: 'Oiseaux Migrateurs', prix: 590,
    dessinateur: 'Cathy Latham', annee: '1977 (réédité 1980)',
    dimensions: '≈ 88–90 cm (à mesurer)',
    titreFr: 'Carré Hermès « Oiseaux Migrateurs »',
    titreEn: 'Hermès « Oiseaux Migrateurs » Silk Scarf',
    etatFr: 'Bon état, passé au pressing, pas de fils tirés.',
    etatEn: 'Good condition, professionally cleaned, no pulled threads.',
    descFr: 'Modèle rare, coté « 1B – très rare et recherché » dans l\'ouvrage de référence Carrés d\'Art III. Une envolée d\'oiseaux migrateurs blancs se détache en silhouette sur un dégradé de bleus, encadrée d\'une large bordure prune. Dessiné par Cathy Latham.',
    descEn: 'A rare model, rated "1B – very rare and sought-after" in the reference work Carrés d\'Art III. A flight of white migratory birds stands in silhouette against a gradient of blues, framed by a wide plum border. Designed by Cathy Latham.',
  },
]

for (let i = 0; i < CARRES.length; i++) {
  const c = CARRES[i]
  const sku = `NR${maxNum + 1 + i}`
  const payload = {
    nom: `${sku} - ${c.titreFr}`,
    nomEn: `${sku} - ${c.titreEn}`,
    description: `${c.descFr}\n\nDessiné par ${c.dessinateur}. Année : ${c.annee}.\nDimensions : ${c.dimensions}.\nÉtat : ${c.etatFr}`,
    descriptionEn: `${c.descEn}\n\nDesigned by ${c.dessinateur}. Year: ${c.annee}.\nDimensions: ${c.dimensions}.\nCondition: ${c.etatEn}`,
    categorie: 'foulard',
    prix: c.prix,
    quantite: 1,
    marque: 'Hermès Paris',
    taille: '',
    material: '100% twill de soie, roulotté à la main',
    color: null,
    madeIn: 'Made in France',
    modele: 'Carré',
    motif: c.modele,
    etat: c.etatFr,
    sku,
    trigramme: 'NR',
    chineurUid,
    ...(chineurEmail ? { chineur: chineurEmail } : {}),
    imageUrls: [],
    imageUrl: '',
    photosReady: false,
    vendu: false,
    recu: false,
    createdAt: FieldValue.serverTimestamp(),
  }
  const ref = await db.collection('produits').add(payload)
  console.log(`✅ ${sku} (${c.modele}) → produits/${ref.id}`)
}

console.log(`\n✅ ${CARRES.length} carrés Hermès créés sous NR.`)
process.exit(0)
