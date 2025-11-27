// scripts/fusion-creatrices-firebase.ts
// Script pour FUSIONNER les anciennes données avec les nouvelles
// ✅ Lit les anciens documents
// ✅ Copie TOUTES les données (Catégorie, siret, tva, etc.)
// ✅ Ajoute les nouveaux champs (slug, accroche, description, etc.)
// ✅ Crée les nouveaux documents avec IDs propres

import { db } from '../src/lib/firebaseConfig'
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'

// 🎨 MAPPING : Nouveaux champs à ajouter
const nouveauxChamps: Record<string, any> = {
  'ines-pineau': {
    slug: 'ines-pineau',
    specialite: 'Bijoux upcyclés',
    accroche: 'BIJOUX UPCYCLÉS FAITS MAIN À PARIS',
    description: `Entrepreneure passionnée, Inès Pineau lance sa marque éponyme début 2017 en parallèle de ses études à l'Atelier Chardon Savard. Chineuse aguerrie, elle a très vite adopté l'upcycling et la transformation comme processus créatif. Chaque pièce est unique, créée à partir d'éléments de récupération de luxe — fermoirs, apprêts de maroquinerie — et de pierres semi-précieuses. Ses créations non-genrées sont fabriquées en éditions limitées, principalement en laiton doré à l'or fin 24k et acier inoxydable.`,
    lien: 'https://inespineau.com',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 1,
  },
  'bonage': {
    slug: 'bonage',
    specialite: 'Vêtements enfant vintage',
    accroche: 'VÊTEMENTS ENFANT SECONDE MAIN ET VINTAGE LUXE',
    description: `BonÂge propose une sélection pointue de vêtements enfant de 0 à 14 ans, alliant seconde main et vintage de luxe. Chaque pièce est soigneusement sélectionnée pour sa qualité et son style intemporel. La marque est également présente au Printemps Haussmann, au 7ème étage du bâtiment femme, où elle propose des pièces exclusives et des collaborations avec des artisans comme Bobbin et Tricot pour des personnalisations brodées main.`,
    lien: 'https://bonage.fr',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 2,
  },
  'tete-dorange': {
    slug: 'tete-dorange',
    specialite: 'Bijoux upcyclés',
    accroche: 'BIJOUX UPCYCLÉS ÉTHIQUES ET RESPONSABLES',
    description: `Tête d'Orange est une marque strasbourgeoise de bijoux upcyclés faits-main à partir de matériaux de qualité. La marque redonne vie à des bijoux vintage et seconde main dans une démarche éco-responsable. Les pièces uniques sont en plaqué or, gold-filled et argent, ornées de pierres semi-précieuses et perles d'eau douce. Portés par des personnalités comme Fanny Sidney, Eva Danino ou Flore Benguigui, ces bijoux allient style et conscience environnementale.`,
    lien: 'https://tete-dorange.com',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 3,
  },
  'the-parisian-vintage': {
    slug: 'the-parisian-vintage',
    specialite: 'Vintage luxe curated',
    accroche: 'CURATED VINTAGE ET DESIGNER ARCHIVES',
    description: `The Parisian Vintage est une boutique de vintage luxe nichée au coeur du Marais, au 20 rue Saint Claude dans le 3ème arrondissement. Spécialisée dans la curation de pièces vintage et d'archives de créateurs, la boutique propose chaque mois de nouvelles trouvailles soigneusement sélectionnées. Un lieu incontournable pour les amateurs de mode à la recherche de pièces uniques et authentiques.`,
    lien: 'https://www.theparisianvintage.com',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 4,
  },
  'aerea-studio': {
    slug: 'aerea-studio',
    specialite: 'Bijoux impression 3D',
    accroche: 'BIJOUX INNOVANTS ENTRE ARTISANAT ET TECHNOLOGIE',
    description: `Fondé par Camille Lefer, designer industriel, Aerea Studio explore les infinies possibilités des technologies 3D pour créer des bijoux minimalistes et éco-responsables. Tous les designs sont conceptualisés par modélisation 3D, fabriqués en impression 3D, puis finis à la main. La marque utilise uniquement des matières recyclées ou biosourcées. Lauréate du Label Fabriqué à Paris, Aerea propose aussi des objets déco aux formes oniriques.`,
    lien: 'https://aerea.studio/fr',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 5,
  },
  'age-paris': {
    slug: 'age-paris',
    specialite: 'Upcycling vêtements',
    accroche: 'PIÈCES UNIQUES UPCYCLÉES AU COEUR DE PARIS',
    description: `Fondée par Eva et Mégane, Âge Paris revalorise des vêtements et accessoires de seconde main pour confectionner des pièces mode durables au coeur de Paris. Le blazer est au coeur de la marque, accompagné d'un vestiaire complet. Chaque pièce est unique et confectionnée en édition limitée. Présente aux Galeries Lafayette Haussmann dans l'espace (RE)store, Âge Paris incarne une mode intemporelle qui traverse les époques.`,
    lien: 'https://ageparis.fr',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 6,
  },
  'maki-corp': {
    slug: 'maki-corp',
    specialite: 'Lunettes reconditionnées',
    accroche: 'LUNETTES VINTAGE RECONDITIONNÉES AVEC EXCELLENCE',
    description: `Maki Corp propose une collection de montures vintage uniques, soigneusement reconditionnées. En collaboration avec Rétroviseur Workshop, opticien spécialisé dans la restauration de lunettes anciennes, la marque élève le reconditionnement au niveau d'un art. Chaque monture est une pièce de collection, restaurée avec une attention au détail exceptionnelle.`,
    lien: 'https://www.makicorp.fr',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 7,
  },
  'personal-seller-paris': {
    slug: 'personal-seller-paris',
    specialite: 'Vente mode seconde main',
    accroche: 'SERVICE DE VENTE MODE SECONDE MAIN SUR MESURE',
    description: `Créée en 2019 par Jeanne Dana et Léa Levy, Personal Seller Paris est une société spécialisée dans les services de vente à la personne pour les particuliers. Ce service sur mesure est né d'une conscience : la possibilité d'optimiser les placards débordant de vêtements grâce aux nouvelles plateformes de revente. L'équipe se déplace chez vous pour un service clé en main.`,
    lien: 'https://personalsellerparis.com',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 8,
  },
  'soir-vintage': {
    slug: 'soir-vintage',
    specialite: 'Archive designer luxe',
    accroche: 'ARCHIVE ET PRE-LOVED DESIGNER CLOTHING',
    description: `Soir Vintage est une boutique spécialisée dans les pièces d'archive et vêtements de créateurs pre-loved. La sélection comprend des pièces iconiques de grandes maisons : Saint Laurent by Hedi Slimane, Roberto Cavalli, Mugler, Tom Ford... Chaque vêtement raconte une histoire de la mode et permet d'accéder à des pièces de collection souvent introuvables.`,
    lien: 'https://www.soirvintage.com',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 9,
  },
  'cent-neuf': {
    slug: 'cent-neuf',
    specialite: 'Mode seconde main',
    accroche: 'LA PREMIERE MARQUE DE MODE DE SECONDE MAIN',
    description: `Fondée en 2022 par Mathilde Carles, Gaultier Desandre Navarre et Alexandre Iris, Cent Neuf propose des collections modernes et élégantes exclusivement composées de pièces de seconde main. Chaque pièce est soigneusement sélectionnée, désinfectée et remise à neuf. Présente au Bon Marché et aux Galeries Lafayette Haussmann, la marque redéfinit le shopping d'occasion avec une direction artistique poussée et un vestiaire cohérent.`,
    lien: 'https://cent-neuf.com',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 10,
  },
  'mission-vintage-paris': {
    slug: 'mission-vintage-paris',
    specialite: 'Seconde main et sacoches',
    accroche: 'SECONDE MAIN ET SACOCHES MADE IN PARIS',
    description: `Fondée par Ben et Olivia, Mission Vintage Paris propose depuis 2 ans une sélection de vêtements de seconde main ainsi que des sacoches originales à l'image de la marque. Un concept store parisien qui connecte vintage et marques émergentes, pour des pièces uniques et accessibles.`,
    lien: 'https://missionvintageparis.fr',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 11,
  },
  'nan-goldies': {
    slug: 'nan-goldies',
    specialite: 'Vintage curaté',
    accroche: 'SELECTION VINTAGE CURATEE',
    description: `Nan Goldies propose une sélection pointue de pièces vintage soigneusement chinées. Un univers unique où chaque pièce raconte une histoire, pour les amateurs de mode à la recherche d'authenticité et de style.`,
    lien: 'https://www.instagram.com/nan.goldies/',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 12,
  },
  'anashi-vintage': {
    slug: 'anashi-vintage',
    specialite: 'Pièces vintage rares',
    accroche: 'PIECES VINTAGE UNIQUES ET RARES',
    description: `Anashi Vintage déniche des pièces vintage uniques et rares pour les passionnés de mode. Une curation soignée qui met en avant des trésors d'archives et des vêtements d'exception introuvables ailleurs.`,
    lien: 'https://www.instagram.com/anashi.vintage/',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 13,
  },
  'pardon-pardon-vintage': {
    slug: 'pardon-pardon-vintage',
    specialite: 'Vintage avec caractère',
    accroche: 'VINTAGE AVEC CARACTERE',
    description: `Pardon Pardon Vintage propose une sélection de pièces vintage avec du caractère. Des trouvailles uniques pour celles et ceux qui veulent affirmer leur style avec des vêtements qui ont une âme.`,
    lien: 'https://www.instagram.com/pardonpardon.vintage/',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 14,
  },
  'rashhiiid': {
    slug: 'rashhiiid',
    specialite: 'Fausse fourrure faite main',
    accroche: 'ACCESSOIRES FAUSSE FOURRURE FAITS MAIN A PARIS',
    description: `Rashhiiid crée des accessoires en fausse fourrure de luxe faits main à Paris. Chapeaux, cagoules, jambières, sacs... Des pièces bold et expressives, 100% vegan et cruelty-free, confectionnées avec les fourrures synthétiques les plus premium du marché. Portée par Megan Thee Stallion, la marque permet à chacun de s'exprimer sans avoir à parler.`,
    lien: 'https://rashhiiid.com',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 15,
  },
  'dark-vintag': {
    slug: 'dark-vintag',
    specialite: 'Vintage dark',
    accroche: 'VINTAGE SOMBRE ET AFFIRME',
    description: `Dark Vintag propose une sélection de pièces vintage à l'esthétique sombre et affirmée. Pour celles et ceux qui cherchent des vêtements avec du caractère, dans un univers dark et assumé.`,
    lien: 'https://www.instagram.com/dark_vintag/',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 16,
  },
  'brillante-paris': {
    slug: 'brillante-paris',
    specialite: 'Accessoires inclusifs',
    accroche: 'ACCESSOIRES TRANS-OWNED CELEBRANT LES MINORITES',
    description: `House of Brillante est une marque d'accessoires trans-owned qui célèbre et unit toutes les minorités. A travers ses pièces comme le Dollkini, la marque crée une extension des vestiaires avec une vision d'empowerment féminin, d'excentricité queer et de revendications fortes.`,
    lien: 'https://brillanteparis.fr',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 17,
  },
  'brujas-friperie': {
    slug: 'brujas-friperie',
    specialite: 'Friperie féministe',
    accroche: 'FRIPERIE FEMINISTE ET SORCIERE A PARIS',
    description: `Brujas Friperie est une friperie parisienne à l'univers féministe et ensorcelé. Les "sœurcières" derrière la marque proposent une sélection vintage soigneusement chinée avec une vibe sorcière assumée. Au-delà des vêtements, Brujas crée aussi des bandeaux de dentelles faits main et organise des événements thématiques dans une ambiance groovy et engagée.`,
    lien: 'https://www.instagram.com/brujas.friperie/',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 18,
  },
  'atelier-archives': {
    slug: 'atelier-archives',
    specialite: 'Pièces imparfaites',
    accroche: 'PIECES IMPARFAITES CELEBRANT LA BEAUTE DE L\'IMPERMANENCE',
    description: `Atelier Archives crée des pièces imparfaites qui célèbrent la beauté de l'impermanence et de la simplicité. La marque valorise l'authenticité et les traces laissées par le temps, dans une philosophie proche du wabi-sabi japonais. Chaque création est une ode à ce qui reste, à ce qui persiste malgré le passage du temps.`,
    lien: 'https://atelierarchives.com/',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 19,
  },
  'pompeznaya-ebuchka': {
    slug: 'pompeznaya-ebuchka',
    specialite: 'Vintage curaté',
    accroche: 'SELECTION VINTAGE CURATEE AVEC CARACTERE',
    description: `Pompeznaya Ebuchka propose une sélection vintage pointue et pleine de caractère. Une curation audacieuse pour celles et ceux qui cherchent des pièces uniques avec une personnalité affirmée.`,
    lien: 'https://www.instagram.com/pompeznaya_ebuchka/',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 20,
  },
  'muse-rebelle': {
    slug: 'muse-rebelle',
    specialite: 'Bijoux vintage et créations',
    accroche: 'BIJOUX VINTAGE ET CREATIONS INTEMPORELLES INSPIREES DE PARIS',
    description: `Fondée par Yev Topyer, styliste et créatrice de contenu, Muse Rebelle propose des bijoux vintage soigneusement curés ainsi que des créations originales inspirées du chic parisien intemporel. Inspirée par des muses comme Lady Diana et Audrey Hepburn, la marque célèbre l'élégance confiante. Les créations maison sont en acier inoxydable recyclé plaqué or 18k, légères et résistantes. Collaboration avec Tara Jarmon.`,
    lien: 'https://muserebelle.com/',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 21,
  },
  'cozines': {
    slug: 'cozines',
    specialite: 'Vintage streetwear',
    accroche: 'SELECTION VINTAGE STREETWEAR ET MODE',
    description: `Cozines propose une sélection vintage pointue mêlant streetwear et pièces mode. Une curation moderne pour un style urbain et authentique.`,
    lien: 'https://www.instagram.com/cozines_off/',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 22,
  },
  'cameleon-luxury': {
    slug: 'cameleon-luxury',
    specialite: 'Luxe vintage',
    accroche: 'LUXE VINTAGE ET PIECES D\'EXCEPTION',
    description: `Cameleon Luxury propose une sélection pointue de pièces de luxe vintage et d'exception. Une curation soignée pour les amateurs de mode haut de gamme à la recherche de trésors d'archives.`,
    lien: 'https://www.instagram.com/cameleon_luxury/',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 23,
  },
  'pristini-vintage': {
    slug: 'pristini-vintage',
    specialite: 'Designer archives colorées',
    accroche: 'DESIGNER ARCHIVES ET MATIERES NOBLES EN COULEURS',
    description: `Pristini Vintage propose des pièces de seconde main aux matières nobles comme la soie et le cuir, dans une explosion de couleurs. Fondée par Cécile Mialet, la marque est présente au 154 rue du Temple dans le Marais et au 7ème ciel du Printemps Haussmann. Une sélection colorée et stylée de designer archives.`,
    lien: 'https://www.instagram.com/pristini.vintage/',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 24,
  },
  'collection-equine': {
    slug: 'collection-equine',
    specialite: 'Vintage équestre',
    accroche: 'FRIPERIE VINTAGE EQUESTRE UNIQUE EN SON GENRE',
    description: `Collection Equine est une friperie vintage équestre unique en son genre. Fondée par une cavalière passionnée depuis l'âge de 3 ans, la marque propose une sélection de textiles vintage avec une esthétique équestre. Après deux ans de t-shirts imprimés en France, la marque s'est transformée en 2024 en friperie vintage dédiée au monde équestre.`,
    lien: 'https://www.instagram.com/collectionequine/',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 25,
  },
  'maison-beguin': {
    slug: 'maison-beguin',
    specialite: 'Déco-dressing vintage',
    accroche: 'DECO-DRESSING VINTAGE ET MODERNE PAR LAURA SEROR',
    description: `Fondée par Laura Seror, Maison Béguin est un concept store parisien mélangeant décoration et dressing vintage. Située au 9 rue Bréguet dans le 11ème, la boutique propose une sélection de pièces vintage et modernes chinées principalement en France. Un lieu où le vintage, le moderne et l'industriel se rencontrent pour créer une harmonie parfaite.`,
    lien: 'https://maisonbeguin.fr/',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 26,
  },
  'prestanx': {
    slug: 'prestanx',
    specialite: 'Vintage curaté',
    accroche: 'SELECTION VINTAGE CURATEE AVEC STYLE',
    description: `Prestanx propose une sélection vintage soigneusement curatée pour un style unique et affirmé. Des pièces chinées avec passion pour celles et ceux qui cherchent l'authenticité.`,
    lien: 'https://www.instagram.com/prestanx/',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 27,
  },
  'sergio-tacchineur': {
    slug: 'sergio-tacchineur',
    specialite: 'Sportswear vintage italien',
    accroche: 'VINTAGE SPORTSWEAR ITALIEN DES ANNEES 80-90',
    description: `Sergio Tacchineur est spécialisé dans le sportswear vintage italien, notamment les pièces iconiques Sergio Tacchini des années 80-90. Survêtements, polos de tennis, vestes colorées... Des pièces cultes portées par les légendes du tennis comme John McEnroe et adoptées par la culture hip-hop et streetwear.`,
    lien: 'https://www.instagram.com/sergiotacchineur/',
    imageUrl: '',
    displayOnWebsite: true,
    ordre: 28,
  },
}

// 🔍 Fonction pour normaliser les noms (enlever accents, majuscules, espaces)
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
    .replace(/[^a-z0-9]/g, '') // Garder que lettres et chiffres
}

// 🔍 Fonction pour trouver le slug correspondant à un nom
function findSlugForNom(nom: string): string | null {
  const normalizedNom = normalizeString(nom)
  
  // Chercher dans les nouveaux champs
  for (const [slug, data] of Object.entries(nouveauxChamps)) {
    // Essayer plusieurs variantes
    const variants = [
      normalizeString(slug), // "ines-pineau" -> "inespineau"
      normalizeString(slug.replace(/-/g, ' ')), // "ines pineau" -> "inespineau"
      normalizeString(data.slug),
    ]
    
    if (variants.some(v => normalizedNom.includes(v) || v.includes(normalizedNom))) {
      return slug
    }
  }
  
  return null
}

// 🚀 FONCTION DE FUSION
async function fusionnerCreateurices() {
  console.log('🔥 Début de la fusion Firebase...\n')

  try {
    // 1. Lire tous les anciens documents
    const querySnapshot = await getDocs(collection(db, 'chineuse'))
    
    console.log(`📦 ${querySnapshot.size} documents trouvés dans Firebase\n`)

    let successCount = 0
    let errorCount = 0
    let skipCount = 0

    for (const docSnap of querySnapshot.docs) {
      const oldData = docSnap.data()
      const oldId = docSnap.id
      const nom = oldData.nom || ''

      // Ignorer les documents qui ont déjà un slug (les nouveaux)
      if (oldId.includes('-') && oldId.length < 30) {
        console.log(`⏭️  ${oldId} - Déjà au bon format, skip`)
        skipCount++
        continue
      }

      // Trouver le slug correspondant
      const slug = findSlugForNom(nom)

      if (!slug) {
        console.log(`⚠️  ${oldId} (${nom}) - Pas de correspondance trouvée, skip`)
        skipCount++
        continue
      }

      try {
        // 2. Créer le nouveau document avec TOUTES les données
        const newDocRef = doc(db, 'chineuse', slug)
        
        const mergedData = {
          ...oldData, // TOUTES les anciennes données (Catégorie, siret, etc.)
          ...nouveauxChamps[slug], // Nouveaux champs (slug, accroche, etc.)
          fusionedAt: new Date().toISOString(),
        }

        await setDoc(newDocRef, mergedData, { merge: true })

        console.log(`✅ ${slug} (depuis ${oldId}) - OK`)
        successCount++
      } catch (error) {
        console.error(`❌ ${slug} - ERREUR:`, error)
        errorCount++
      }
    }

    console.log('\n🎉 Terminé!')
    console.log(`✅ Fusionnés: ${successCount}`)
    console.log(`⏭️  Skippés: ${skipCount}`)
    console.log(`❌ Erreurs: ${errorCount}`)
    
    if (successCount > 0) {
      console.log('\n⚠️  IMPORTANT: Vérifie les nouveaux documents dans Firebase,')
      console.log('   puis supprime manuellement les anciens (IDs longs).')
    }

  } catch (error) {
    console.error('\n💥 Erreur fatale:', error)
    throw error
  }
}

// 🎬 EXÉCUTION
fusionnerCreateurices()
  .then(() => {
    console.log('\n✨ Script de fusion terminé')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Erreur:', error)
    process.exit(1)
  })