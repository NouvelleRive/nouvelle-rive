// Remplit FR + EN pour les 3 iconiques restées en lorem ipsum :
// baguette-fendi, lunettes-chanel, revenge-dress.
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

const CONTENT = {
  'baguette-fendi': {
    nom: 'Baguette Fendi',
    nomEn: 'Fendi Baguette',
    pourquoiMust:
      "Le it-bag des 90s qui s'arrache aujourd'hui à 4 chiffres en seconde main",
    pourquoiMustEn:
      'The 90s it-bag that fetches four-figure prices second-hand today',
    histoire:
      "Créée en 1997 par Silvia Venturini Fendi, la Baguette doit son nom à sa façon de se porter sous le bras — comme une baguette de pain. Carrie Bradshaw la sacre it-bag dans Sex and the City, avec une scène culte où elle se la fait voler aux cris de « It's a Baguette ! ». Plus de 1 000 versions ont été déclinées depuis : brodées de paillettes, en velours, en cuir python ou en mosaïque. Les modèles vintage des années 90-2000 sont les plus convoités, avec des cotes qui s'envolent à chaque réédition.",
    histoireEn:
      'Created in 1997 by Silvia Venturini Fendi, the Baguette gets its name from how it\'s worn tucked under the arm — like a baguette of bread. Carrie Bradshaw made it the it-bag in Sex and the City, with one iconic scene where she gets mugged for it screaming "It\'s a Baguette!". Over 1,000 versions have been released since: embroidered with sequins, in velvet, python leather or mosaic. Vintage models from the 90s and 2000s are the most coveted, with prices climbing at every reissue.',
  },
  'lunettes-chanel': {
    nom: 'Lunettes Chanel',
    nomEn: 'Chanel Sunglasses',
    pourquoiMust:
      "L'accessoire signature qui transforme n'importe quelle silhouette en icône",
    pourquoiMustEn:
      'The signature accessory that turns any silhouette into an icon',
    histoire:
      "Karl Lagerfeld réinvente la lunette Chanel dans les années 80 en y apposant le double C — geste audacieux qui transforme un accessoire fonctionnel en manifeste de la maison. Surdimensionnées, gravées, parfois ornées de cristaux ou de chaînes dorées, les Chanel vintage des années 90 deviennent l'arme préférée des supermodels et des paparazzi shots. Aujourd'hui, les modèles d'archive (5060, 5096, 4017) s'arrachent en seconde main, introuvables en boutique.",
    histoireEn:
      'Karl Lagerfeld reinvented Chanel sunglasses in the 80s by adding the double C — a bold gesture that turned a functional accessory into a manifesto for the house. Oversized, engraved, sometimes adorned with crystals or gold chains, vintage 90s Chanel frames became the weapon of choice for supermodels and paparazzi shots. Today, archive models (5060, 5096, 4017) get snapped up second-hand — long gone from boutiques.',
  },
  'revenge-dress': {
    nom: 'Revenge Dress',
    nomEn: 'Revenge Dress',
    pourquoiMust:
      'La petite robe noire la plus politique de la mode — à porter quand il faut faire passer un message',
    pourquoiMustEn:
      'The most political little black dress in fashion — to wear when you need to send a message',
    histoire:
      "Le 29 juin 1994, le soir même où le Prince Charles avoue son infidélité à la télévision britannique, la Princesse Diana sort vêtue d'une petite robe noire courte, épaules nues, signée Christina Stambolian. La presse la baptise aussitôt « The Revenge Dress ». Dans un protocole royal qui interdisait le noir hors deuil et les épaules dénudées, c'est une déclaration silencieuse mais fracassante. Depuis, la petite robe noire courte porte la mémoire de cette nuit-là — celle où l'on choisit de ne plus s'effacer.",
    histoireEn:
      'On June 29, 1994 — the very night Prince Charles admitted his infidelity on British television — Princess Diana stepped out in a short off-the-shoulder little black dress by Christina Stambolian. The press immediately called it "The Revenge Dress." In a royal protocol that banned black outside of mourning and forbade bare shoulders, it was a silent but seismic statement. Since then, the short little black dress has carried the memory of that night — the one when she chose to no longer fade into the background.',
  },
}

let written = 0
const errors = []

for (const [docId, fields] of Object.entries(CONTENT)) {
  try {
    await db.collection('iconiques').doc(docId).update(fields)
    written++
    console.log(`✓ ${docId}`)
  } catch (e) {
    errors.push({ docId, msg: e.message })
    console.error(`✗ ${docId}: ${e.message}`)
  }
}

console.log('─'.repeat(60))
console.log(`OK: ${written}  |  Errors: ${errors.length}`)
if (errors.length) console.log(JSON.stringify(errors, null, 2))
