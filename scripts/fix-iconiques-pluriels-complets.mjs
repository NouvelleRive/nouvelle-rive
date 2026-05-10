import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

// Vintages avec nomPluriel/En manquants → on les set proprement
const vintageFixes = {
  'bijoux-xxl':         { nomPluriel: 'Bijoux XXL',                       nomPlurielEn: 'XXL Jewelry' },
  'blazer-luxe-80s':    { nomPluriel: 'Blazers de Luxe 80s',              nomPlurielEn: '80s Luxury Blazers' },
  'blazer-tweed':       { nomPluriel: 'Blazers Tweed',                    nomPlurielEn: 'Tweed Blazers' },
  'boucles-80s-dorees': { nomPluriel: "Boucles d'Oreilles Statement",     nomPlurielEn: 'Statement Earrings' },
  'broches':            { nomPluriel: 'Broches',                          nomPlurielEn: 'Brooches' },
  'carre-hermes':       { nomPluriel: 'Carrés Hermès',                    nomPlurielEn: 'Hermès Scarves' },
  'escarpins-cuir':     { nomPluriel: 'Escarpins en Cuir',                nomPlurielEn: 'Leather Pumps' },
  'fourrure-vintage':   { nomPluriel: 'Fourrures Vintage',                nomPlurielEn: 'Vintage Furs' },
  'levis-501':          { nomPluriel: "Jeans Levi's",                     nomPlurielEn: "Levi's Jeans" },
  'lunettes-chanel':    { nomPluriel: 'Lunettes Chanel',                  nomPlurielEn: 'Chanel Sunglasses' },
  'timeless-chanel':    { nomPluriel: 'Sacs Chanel',                      nomPlurielEn: 'Chanel Bags' },
  'trench-burberry':    { nomPluriel: 'Trenchs Burberry',                 nomPlurielEn: 'Burberry Trenches' },
  'veste-jean':         { nomPluriel: 'Vestes en Jean',                   nomPlurielEn: 'Denim Jackets' },
}

for (const [id, vals] of Object.entries(vintageFixes)) {
  const ref = db.collection('iconiques').doc(id)
  const snap = await ref.get()
  if (!snap.exists) { console.log(`SKIP ${id} (introuvable)`); continue }
  await ref.update(vals)
  console.log(`OK  ${id}  → "${vals.nomPluriel}" / "${vals.nomPlurielEn}"`)
}

// Pour collier-montre : inclure aussi bagues et broches, trier colliers en premier
const cmRef = db.collection('iconiques').doc('collier-montre-ines-pineau')
await cmRef.update({
  categorieRecherche: '',                           // on ne filtre plus par "montre" dans le nom
  categoriesIn: ['collier', 'bague', 'broche'],     // matching sur les 3 catégories
  categoriesOrder: ['collier', 'bague', 'broche'],  // tri d'affichage
})
console.log('\nOK  collier-montre-ines-pineau → categoriesIn + categoriesOrder = [collier, bague, broche]')

console.log('\nFini.')
process.exit(0)
