// Test du parser Chronopost "Votre colis est en chemin".
// Run: npx tsx scripts/test-parser-chronopost.ts

import { parseChronopostEnChemin } from '../src/modules/achat/parser/chronopost'

const sample1 = `Le logo Chronopost

Statut de votre colis
Bonjour,

Votre colis XW447030880TS est en chemin.

Information importante :

Vous recevrez un email ou SMS à l'arrivée de votre colis dans le relais Pickup vous indiquant les modalités de retrait.
Nous vous invitons à attendre ce message afin d'éviter tout déplacement inutile.

Vous disposerez de 8 jours, à compter de la date de mise à disposition, pour retirer le colis.

Retrouvez le suivi de colis en cliquant ici.

A bientôt.

Le logo DPD Le logo Chronopost`

const cases = [
  {
    name: 'Sample 1 (XW447030880TS en chemin)',
    body: sample1,
    expect: {
      numeroSuivi: 'XW447030880TS',
      provenance: 'chronopost',
    },
  },
]

let passed = 0
let failed = 0

for (const tc of cases) {
  const result = parseChronopostEnChemin(tc.body)
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
    console.log(`   numéro suivi : ${result.numeroSuivi}`)
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
