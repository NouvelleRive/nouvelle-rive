import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCHAQITC3n40WDQXLN4OAflmlE5lNG42SM",
  authDomain: "nouvelle-rive.firebaseapp.com",
  projectId: "nouvelle-rive",
  storageBucket: "nouvelle-rive.appspot.com",
  messagingSenderId: "367296973767",
  appId: "1:367296973767:web:c2d7d052bf4e15db0e67e2"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const iconiques = [
  {
    slug: 'trench-burberry',
    nom: 'Trench Burberry',
    dateCreation: '1879',
    histoire: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    valeurNeuf: 1890,
    tendancePrix: 'monte',
    pourquoiMust: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    categorieRecherche: 'trench',
    images: [],
    ordre: 1,
    displayOnWebsite: true
  },
  {
    slug: 'timeless-chanel',
    nom: 'Timeless Chanel',
    dateCreation: '1955',
    histoire: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    valeurNeuf: 8900,
    tendancePrix: 'monte',
    pourquoiMust: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    categorieRecherche: 'sac-chanel',
    images: [],
    ordre: 2,
    displayOnWebsite: true
  },
  {
    slug: 'baguette-fendi',
    nom: 'Baguette Fendi',
    dateCreation: '1997',
    histoire: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    valeurNeuf: 3200,
    tendancePrix: 'monte',
    pourquoiMust: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    categorieRecherche: 'sac-fendi',
    images: [],
    ordre: 3,
    displayOnWebsite: true
  },
  {
    slug: 'lunettes-chanel',
    nom: 'Lunettes Chanel',
    dateCreation: '1960',
    histoire: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    valeurNeuf: 450,
    tendancePrix: 'descend',
    pourquoiMust: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    categorieRecherche: 'lunettes',
    images: [],
    ordre: 4,
    displayOnWebsite: true
  },
  {
    slug: 'levis-501',
    nom: 'Levi\'s 501',
    dateCreation: '1873',
    histoire: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    valeurNeuf: 98,
    tendancePrix: 'descend',
    pourquoiMust: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    categorieRecherche: 'jean',
    images: [],
    ordre: 5,
    displayOnWebsite: true
  },
  {
    slug: 'blazer-luxe-80s',
    nom: 'Blazer Luxe 80s',
    dateCreation: '1985',
    histoire: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    valeurNeuf: 1200,
    tendancePrix: 'monte',
    pourquoiMust: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    categorieRecherche: 'blazer',
    images: [],
    ordre: 6,
    displayOnWebsite: true
  },
  {
    slug: 'escarpins-cuir',
    nom: 'Escarpins Cuir Vintage',
    dateCreation: '1970',
    histoire: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    valeurNeuf: 650,
    tendancePrix: 'descend',
    pourquoiMust: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    categorieRecherche: 'chaussures',
    images: [],
    ordre: 7,
    displayOnWebsite: true
  },
  {
    slug: 'boucles-80s-dorees',
    nom: 'Boucles d\'Oreilles 80s Dorées',
    dateCreation: '1982',
    histoire: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    valeurNeuf: 180,
    tendancePrix: 'monte',
    pourquoiMust: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    categorieRecherche: 'bijoux',
    images: [],
    ordre: 8,
    displayOnWebsite: true
  },
  {
    slug: 'fourrure-vintage',
    nom: 'Fourrure Vintage',
    dateCreation: '1950',
    histoire: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    valeurNeuf: 5000,
    tendancePrix: 'monte',
    pourquoiMust: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    categorieRecherche: 'manteau',
    images: [],
    ordre: 9,
    displayOnWebsite: true
  },
  {
    slug: 'revenge-dress',
    nom: 'Revenge Dress',
    dateCreation: '1994',
    histoire: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    valeurNeuf: 3500,
    tendancePrix: 'monte',
    pourquoiMust: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    categorieRecherche: 'robe',
    images: [],
    ordre: 10,
    displayOnWebsite: true
  }
]

async function importIconiques() {
  console.log('🚀 Import Iconiques BETA...\n')
  
  let successCount = 0
  
  for (const iconique of iconiques) {
    try {
      const docRef = doc(db, 'iconiques', iconique.slug)
      await setDoc(docRef, iconique, { merge: false })
      console.log(`✅ ${iconique.nom}`)
      successCount++
    } catch (error) {
      console.error(`❌ ${iconique.nom}:`, error)
    }
  }
  
  console.log(`\n✅ ${successCount}/10 créés`)
}

importIconiques().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1) })