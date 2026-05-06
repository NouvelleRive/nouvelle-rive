// scripts/update-iconiques-2026.ts
// Met à jour les iconiques avec les filtres + texte définitif (mai 2026).
// Usage : npx tsx scripts/update-iconiques-2026.ts
// Utilise le SDK Admin (clés dans functions/serviceAccountKey.json) pour bypasser les rules Firestore.

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as fs from 'fs'
import * as path from 'path'

const keyPath = path.join(__dirname, '..', 'functions', 'serviceAccountKey.json')
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'))

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) })
}

const db = getFirestore()

// Lookup trigramme à partir du nom de chineuse (case-insensitive, contient)
async function findTrigrammeByNom(nom: string): Promise<string | null> {
  const snap = await db.collection('chineuse').get()
  const target = nom.toLowerCase().trim()
  for (const d of snap.docs) {
    const data = d.data() as any
    const n = (data.nom || '').toLowerCase().trim()
    if (n === target || n.includes(target) || target.includes(n)) {
      return data.trigramme || null
    }
  }
  return null
}

async function main() {
  console.log('🔄 Mise à jour des iconiques (mai 2026)...\n')

  const trigGigi = await findTrigrammeByNom('Gigi Paris')
  // En base la chineuse s'appelle "CHINEUZ2BLING" (orthographe stylisée)
  const trigBling = (await findTrigrammeByNom('CHINEUZ2BLING')) || (await findTrigrammeByNom('bling'))
  console.log(`   → Gigi Paris : ${trigGigi || 'NON TROUVÉE'}`)
  console.log(`   → Chineuse de Bling : ${trigBling || 'NON TROUVÉE'}\n`)

  const updates = [
    {
      id: 'trench-burberry',
      data: {
        nom: 'Trenchs Burberry',
        dateCreation: '1879',
        histoire: "Inventé par Thomas Burberry en 1879, le trench-coat naît pour habiller les officiers britanniques pendant la Première Guerre mondiale. Sa gabardine waterproof, brevetée en 1888, en fait l'arme secrète des tranchées — d'où son nom. Devenu icône civile dès les années 30, il habille Audrey Hepburn dans Diamants sur Canapé et Humphrey Bogart dans Casablanca.",
        valeurNeuf: 1990,
        tendancePrix: 'monte',
        pourquoiMust: 'Le must-have intemporel — un trench Burberry vintage gagne 8% par an en valeur',
        categorieRecherche: 'trench',
        marque: 'Burberry',
        chineuseTrigrammes: [],
        categoriesIn: [],
        materialContient: '',
      },
    },
    {
      id: 'timeless-chanel',
      data: {
        nom: 'Sacs Chanel',
        dateCreation: '1955',
        histoire: "Le 2.55, créé par Coco Chanel en février 1955 (d'où son nom), est le premier sac à bandoulière de luxe — révolution à une époque où les femmes portaient encore leurs sacs à la main. Son matelassage évoque les vestes des jockeys de Longchamp ; sa chaîne, les ceintures des gardiennes d'orphelinat de Coco. Le 11.12, plus tard popularisé par Karl Lagerfeld avec le double C, devient l'autre pilier de la maison.",
        valeurNeuf: 9800,
        tendancePrix: 'monte',
        pourquoiMust: 'Sa cote a doublé en 10 ans — un investissement plus rentable que le S&P 500',
        categorieRecherche: 'sac',
        marque: 'Chanel',
        chineuseTrigrammes: [],
        categoriesIn: [],
        materialContient: '',
      },
    },
    {
      id: 'levis-501',
      data: {
        nom: "Jeans Levi's",
        dateCreation: '1873',
        histoire: "Levi Strauss et Jacob Davis brevettent en 1873 un pantalon en denim renforcé par des rivets de cuivre, pensé pour les chercheurs d'or de Californie. Le 501, son modèle phare à coupe droite et bouton-fly, traverse les décennies sans rides : porté par James Dean, Marilyn Monroe, Bruce Springsteen. Aujourd'hui, un 501 vintage des années 50-60 (Big E, redline selvedge) peut atteindre plusieurs milliers d'euros chez les collectionneurs japonais.",
        valeurNeuf: 110,
        tendancePrix: 'monte',
        pourquoiMust: "Les modèles vintage Big E des 60s s'arrachent à 4 chiffres au Japon",
        categorieRecherche: 'jean',
        marque: "Levi's",
        chineuseTrigrammes: [],
        categoriesIn: [],
        materialContient: '',
      },
    },
    {
      id: 'blazer-luxe-80s',
      data: {
        nom: 'Blazers de Luxe 80s',
        dateCreation: '1980',
        histoire: "Les années 80 transforment le blazer en arme de pouvoir. Yves Saint Laurent avec son smoking, Giorgio Armani avec ses épaules sculptées et ses tissus fluides, Thierry Mugler avec ses tailles cintrées — tous redessinent la silhouette féminine pour les conseils d'administration. Le power suit devient le manifeste de toute une génération de working girls. Quarante ans plus tard, ces pièces vintage signées YSL, Mugler ou Versace sont les plus convoitées des friperies.",
        valeurNeuf: 1500,
        tendancePrix: 'monte',
        pourquoiMust: "L'esprit power dressing en pièce vintage signée maison de luxe",
        categorieRecherche: 'blazer',
        marque: 'luxe',
        chineuseTrigrammes: [],
        categoriesIn: [],
        materialContient: '',
      },
    },
    {
      id: 'boucles-80s-dorees',
      data: {
        nom: "Boucles d'Oreilles Statement",
        dateCreation: '1985',
        histoire: "Les années 80 sont l'âge d'or des boucles d'oreilles XXL : créoles surdimensionnées, clips géométriques, perles surmoulées. Une pièce qui transforme un look en un instant, et que les designeuses parisiennes comme Gigi Paris et Chineuse de Bling réinterprètent aujourd'hui avec leur regard upcyclé.",
        valeurNeuf: 220,
        tendancePrix: 'monte',
        pourquoiMust: "L'accessoire qui change tout — choisi par nos créatrices upcyclistes",
        categorieRecherche: 'boucle',
        marque: '',
        chineuseTrigrammes: [trigGigi, trigBling].filter(Boolean) as string[],
        categoriesIn: [],
        materialContient: '',
      },
    },
    {
      id: 'escarpins-cuir',
      data: {
        nom: 'Escarpins en Cuir',
        dateCreation: '1953',
        histoire: "Marilyn Monroe l'a immortalisé en 1955 dans Sept Ans de Réflexion : la robe blanche et les escarpins. Mais l'escarpin tel qu'on le connaît naît plus tôt, avec Roger Vivier qui crée le premier talon aiguille pour Christian Dior en 1953. Outil d'élégance, arme de séduction, l'escarpin en cuir reste l'allié de toutes les silhouettes — Carrie Bradshaw avec ses Manolo Blahnik en a fait son fétiche dans Sex and the City.",
        valeurNeuf: 750,
        tendancePrix: 'monte',
        pourquoiMust: "L'élégance intemporelle qui transforme n'importe quelle silhouette",
        categorieRecherche: 'escarpin',
        marque: '',
        chineuseTrigrammes: [],
        categoriesIn: [],
        materialContient: '',
      },
    },
    {
      id: 'fourrure-vintage',
      data: {
        nom: 'Fourrures Vintage',
        dateCreation: '1950',
        histoire: "Avant les années 90 et la prise de conscience animale, la fourrure était le symbole ultime du luxe et du glamour : Grace Kelly, Liz Taylor, Ava Gardner — toutes l'ont portée. Aujourd'hui, le seul moyen éthique de se l'offrir est en seconde main : ces pièces vintage, déjà existantes, ne génèrent plus aucun nouvel impact animal. Recycler ce qui existe, c'est l'essence même de la mode circulaire.",
        valeurNeuf: 5500,
        tendancePrix: 'monte',
        pourquoiMust: "Le glamour Old Hollywood, sans nouvel impact animal",
        categorieRecherche: '',
        marque: '',
        chineuseTrigrammes: [],
        categoriesIn: ['manteau', 'veste'],
        materialContient: 'fourrure',
      },
    },
  ]

  for (const u of updates) {
    try {
      await db.collection('iconiques').doc(u.id).set(u.data, { merge: true })
      console.log(`✅ ${u.id} mis à jour`)
    } catch (err: any) {
      console.error(`❌ ${u.id}:`, err?.message || err)
    }
  }

  console.log('\n✅ Terminé')
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
