// Test du parser Chronopost Pickup "Votre colis est arrivé en relais".
// Run: npx tsx scripts/test-parser-chronopost-pickup.ts

import { parseChronopostPickupDispo } from '../src/modules/achat/parser/chronopostPickup'

const sample1 = `DPD-Pickup

Récupérez votre colis avant le 4 juin 2026 en présentant votre Pickup Pass

Pour retirer votre colis présentez ce Pickup Pass
au relais HAK MINI MARKET.
En cas de problème ou si vous ne pouvez pas présenter le Pickup Pass,
communiquez le code de retrait suivant au commerçant : 893515

Détails du colis
Numéro de colis
XW447647819TS
Expéditeur
VINTED
Statut
Disponible
en relais
À retirer jusqu'au
jeudi
04 juin 2026

Comment retirer votre colis en relais ?
Présentez votre Pickup Pass ou le code de retrait ci-dessus.

Détails du relais Pickup

HAK MINI MARKET
59 BOULEVARD SAINT MARCEL
75013 PARIS

Voir sur la carte

Horaires d'ouverture :
lun. - dim. 10:30 - 22:00

Voir le relais

Pour récupérer votre colis, privilégiez la marche, le vélo ou les transports en commun.

Chronopost s'engage…`

const cases = [
  {
    name: 'Sample 1 (HAK MINI MARKET, XW447647819TS)',
    body: sample1,
    expect: {
      numeroSuivi: 'XW447647819TS',
      codeRetrait: '893515',
      dateLimiteRetrait: '04 juin 2026',
      nomRelais: 'HAK MINI MARKET',
      adresseRelais: '59 BOULEVARD SAINT MARCEL, 75013 PARIS',
      lieuLivraison: 'HAK MINI MARKET · 59 BOULEVARD SAINT MARCEL, 75013 PARIS',
    },
  },
]

let passed = 0
let failed = 0

for (const tc of cases) {
  const result = parseChronopostPickupDispo(tc.body)
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
  if (errors.length === 0) {
    console.log(`\n✅ ${tc.name}`)
    console.log(`   colis #${result.numeroSuivi} → code ${result.codeRetrait}, retrait avant ${result.dateLimiteRetrait}`)
    console.log(`   lieu : ${result.lieuLivraison}`)
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
