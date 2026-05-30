// Test du parser Mondial Relay sur de vrais mails "Colis disponible".
// Run: npx tsx scripts/test-parser-mondial-relay.ts
//
// Les noms personnels et emails tiers ont été redactés conformément à la règle
// projet "jamais de nom personnel en public".

import { parseMondialRelayDispo } from '../src/modules/achat/parser/mondialRelay'

const sample1 = `Mondial Relay by InPost

Bonne nouvelle ACHETEUR,
Votre colis n°46563517 est disponible !

CODE DE RETRAIT
453984

RETRAIT JUSQU'AU
03/06

POINT RELAIS®
MERCERIE
119 RUE DE LA GLACIÈRE
75013 PARIS

SUPER PRATIQUE
Retrouvez toutes les informations relatives à votre Point Relais® juste ici !
Je consulte

UN IMPRÉVU ?
Passez le relais en transférant ce mail à un proche.
S'y rendre

L'équipe Mondial Relay by InPost`

const sample2 = `Mondial Relay by InPost

Bonne nouvelle ACHETEUR,
Votre colis n°46512671 est disponible !

CODE DE RETRAIT
184429

RETRAIT JUSQU'AU
02/06

POINT RELAIS®
MARCHE D A COTE
3 Rue du Moulin des Prés
75013 Paris

SUPER PRATIQUE
Retrouvez toutes les informations relatives à votre Point Relais® juste ici !
Je consulte`

const sampleRedirige = `
Votre colis sera livré dans un autre Point Relais®

Bonjour ACHETEUR
Votre Point Relais® initial étant temporairement indisponible, votre colis 46563517 sera finalement livré à cette adresse :

MERCERIE
119 RUE DE LA GLACIÈRE
75013 PARIS

Nous sommes navrés de la gêne occasionnée et vous informerons dès que votre colis sera disponible.

Pour plus d'information,
cliquez sur le lien ci-dessous :

Suivre mon colis
L'équipe Mondial Relay`

const cases = [
  {
    name: 'Sample 1 (Mercerie 75013, disponible)',
    body: sample1,
    expect: {
      kind: 'disponible',
      numeroColis: '46563517',
      codeRetrait: '453984',
      dateLimiteRetrait: '03/06',
      nomRelais: 'MERCERIE',
      adresseRelais: '119 RUE DE LA GLACIÈRE, 75013 PARIS',
      lieuLivraison: 'MERCERIE · 119 RUE DE LA GLACIÈRE, 75013 PARIS',
    },
  },
  {
    name: 'Sample 2 (Marche d\'à côté, disponible)',
    body: sample2,
    expect: {
      kind: 'disponible',
      numeroColis: '46512671',
      codeRetrait: '184429',
      dateLimiteRetrait: '02/06',
      nomRelais: 'MARCHE D A COTE',
      adresseRelais: '3 Rue du Moulin des Prés, 75013 Paris',
      lieuLivraison: 'MARCHE D A COTE · 3 Rue du Moulin des Prés, 75013 Paris',
    },
  },
  {
    name: 'Sample 3 (Mercerie, relais redirigé)',
    body: sampleRedirige,
    expect: {
      kind: 'redirige',
      numeroColis: '46563517',
      codeRetrait: '',
      dateLimiteRetrait: '',
      nomRelais: 'MERCERIE',
      adresseRelais: '119 RUE DE LA GLACIÈRE, 75013 PARIS',
      lieuLivraison: 'MERCERIE · 119 RUE DE LA GLACIÈRE, 75013 PARIS',
    },
  },
]

let passed = 0
let failed = 0

for (const tc of cases) {
  const result = parseMondialRelayDispo(tc.body)
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
    console.log(`   colis #${result.numeroColis} → code ${result.codeRetrait}, retrait avant ${result.dateLimiteRetrait}`)
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
