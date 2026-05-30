// Test du parser Whatnot (mail "Merci pour ton achat...").
// Run: npx tsx scripts/test-parser-whatnot.ts
//
// Le nom/prénom et email de l'utilisateur ayant transféré le mail ont été
// redactés conformément à la règle projet "jamais de nom personnel en public".

import { parseWhatnotPurchase, whatnotDocId } from '../src/modules/achat/parser/whatnot'

const sample1 = `---------- Message transféré ---------
De : Whatnot <orders@whatnot.com>
Date : mar. 26 mai 2026 à 23:07
Objet : Merci pour ton achat chez maisonjuliebosquet sur Whatnot !
À : <ACHETEUR@example.com>

Merci pour ton achat chez maisonjuliebosquet sur Whatnot !
Livraison
Merci pour ta commande ! Le vendeur, maisonjuliebosquet, expédie généralement la commande sous 1 jour(s) ouvrable(s).

Détails de la commande

PAS D'ANNULATION PDD 50€ #4
Order #1064236555
€78.18
View Order
View Order
Sous-total €74.00
Taxe (incluse) €0.70
Livraison €4.18
Total €78.18

PAS D'ANNULATION PDD 50€ #6
Order #1064295007
€187.54
View Order
View Order
Sous-total €187.00
Taxe (incluse) €0.09
Livraison €0.54
Total €187.54

Informations client
Adresse de livraison
ACHETEUR
ADRESSE_REDACTEE
Paris, 75009
FR

Mode de paiement
Mastercard - 3341 - 3/2028

Voir la commande
Ta commande est protégée par la politique de protection des acheteurs de Whatnot

Whatnot Inc.
© 2026 Whatnot Inc.`

const cases = [
  {
    name: 'Sample 1 (2 commandes regroupées)',
    body: sample1,
    expect: {
      vendeur: 'maisonjuliebosquet',
      itemsCount: 2,
    },
    expectItems: [
      { titre: "PAS D'ANNULATION PDD 50€ #4", orderId: '1064236555', prixTotal: 78.18, prixSousTotal: 74, taxe: 0.70, livraison: 4.18 },
      { titre: "PAS D'ANNULATION PDD 50€ #6", orderId: '1064295007', prixTotal: 187.54, prixSousTotal: 187, taxe: 0.09, livraison: 0.54 },
    ],
  },
]

let passed = 0
let failed = 0

for (const tc of cases) {
  const result = parseWhatnotPurchase(tc.body)
  if (!result.ok) {
    console.log(`\n❌ ${tc.name}: ${result.reason}`)
    failed++
    continue
  }
  const errors: string[] = []
  if (result.vendeur !== tc.expect.vendeur) {
    errors.push(`  vendeur: attendu ${JSON.stringify(tc.expect.vendeur)}, reçu ${JSON.stringify(result.vendeur)}`)
  }
  if (result.items.length !== tc.expect.itemsCount) {
    errors.push(`  itemsCount: attendu ${tc.expect.itemsCount}, reçu ${result.items.length}`)
  }
  for (let i = 0; i < (tc.expectItems?.length || 0); i++) {
    const exp = tc.expectItems![i]
    const got = result.items[i]
    if (!got) {
      errors.push(`  item[${i}] manquant`)
      continue
    }
    for (const [k, v] of Object.entries(exp)) {
      if ((got as any)[k] !== v) {
        errors.push(`  items[${i}].${k}: attendu ${JSON.stringify(v)}, reçu ${JSON.stringify((got as any)[k])}`)
      }
    }
  }
  if (errors.length === 0) {
    console.log(`\n✅ ${tc.name}`)
    console.log(`   vendeur ${result.vendeur} · ${result.items.length} commande(s)`)
    result.items.forEach((it) => {
      console.log(`   - ${whatnotDocId(it.orderId)} : ${it.titre} → ${it.prixTotal}€`)
    })
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
