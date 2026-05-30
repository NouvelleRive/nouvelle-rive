// Test du parser de page Vinted (contenu collé depuis l'annonce).
// Run: npx tsx scripts/test-parser-vinted-page.ts

import { parseVintedPage, vintedPageDocId } from '../src/modules/achat/parser/vintedPage'

const sample1 = `https://www.vinted.fr/items/9004497535-top-ibiza
Logo Vinted
Rechercher des articles

Enlevé !
FemmesVêtementsHauts et t-shirtsTops dos nuInconnu Tops dos nu
Dressing du membre

Vendu
Top ibiza
S / 36 / 8·Très bon état·Inconnu
15,00 €
18,00 €

16,45 €
Inclut la Protection acheteurs

MarqueInconnu
Taille
S / 36 / 8
État
Très bon état
Couleur
Bleu
Ajouté
Il y a 4 jours
Jamais porté 😊
Reçu trop grand…
Envoi
à partir de 2,88 €

Achète et vends en toute sécurité
Pour chaque achat effectué, tu bénéficies de notre Politique de remboursement

lisa_g41
19
Publie activement
Mont-prés-Chambord, France
Vu la dernière fois : il y a 22 minutes`

const cases = [
  {
    name: 'Sample 1 (page Top ibiza, lisa_g41)',
    body: sample1,
    expect: {
      provenance: 'vinted-page',
      titre: 'Top Ibiza',
      marque: 'Inconnu',
      taille: 'S / 36 / 8',
      etat: 'Très bon état',
      couleur: 'Bleu',
      vendeur: 'lisa_g41',
      prixArticle: 15.00,
      prixAvecProtection: 16.45,
      itemId: '9004497535',
    },
    expectDescriptionContains: ['Jamais porté', 'Reçu trop grand'],
  },
]

let passed = 0
let failed = 0

for (const tc of cases) {
  const result = parseVintedPage(tc.body)
  if (!result.ok) {
    console.log(`\n❌ ${tc.name}: ${result.reason}`)
    failed++
    continue
  }
  const errors: string[] = []
  for (const [k, v] of Object.entries(tc.expect)) {
    const actual = (result as any)[k]
    if (actual !== v) errors.push(`  ${k}: attendu ${JSON.stringify(v)}, reçu ${JSON.stringify(actual)}`)
  }
  for (const needle of tc.expectDescriptionContains || []) {
    if (!result.description.includes(needle)) {
      errors.push(`  description doit contenir "${needle}", reçu : "${result.description}"`)
    }
  }
  if (errors.length === 0) {
    console.log(`\n✅ ${tc.name}`)
    console.log(`   docId : ${result.itemId ? vintedPageDocId(result.itemId) : '(pas d\'itemId)'}`)
    console.log(`   ${result.titre} — ${result.marque} ${result.taille} ${result.couleur} (${result.etat})`)
    console.log(`   description : "${result.description}"`)
    console.log(`   vendeur ${result.vendeur} · article ${result.prixArticle}€ · total ${result.prixAvecProtection}€`)
    passed++
  } else {
    console.log(`\n❌ ${tc.name}`)
    errors.forEach((e) => console.log(e))
    failed++
  }
}

console.log(`\n${'='.repeat(50)}`)
console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
