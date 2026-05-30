// Test du parser Vinted sur de vrais mails de confirmation.
// Run: npx tsx scripts/test-parser-vinted.ts

import { parseVintedReceipt, vintedDocId } from '../src/modules/achat/parser/vinted'
import { buildVintedProduitPayload } from '../src/modules/achat/payload'
import { suggestPrixVente } from '../src/modules/achat/types'

const sample1 = `Bonjour nouvellerive,
Votre paiement a été reçu.
Reçu pour votre commande Vinted :

Vendeur	fripants
Commande	Jean Twist Barrel Leg COS gris foncé / noir | W27

Montant payé	77,19 €
Article	70,00 €
Frais de port	2,99 €
Frais de Protection acheteurs	4,20 €

Mode de paiement	Apple Pay (77,19 €)
Date du paiement	26/05/2026 11 h 52
N° de transaction	20032156409

Nous vous enverrons un message dès que fripants aura expédié l'article « Jean Twist Barrel Leg COS gris foncé / noir | W27 ».

Informations sur le vendeur

Adresse de l'entreprise : LUCAS SIMON YANIS DUMORTIER, 102 Avenue André Emery, Brive-la-Gaillarde, 19100, FR, France
Adresse de retour : LUCAS SIMON YANIS DUMORTIER, 102 Avenue André Emery, Brive-la-Gaillarde, 19100, FR, France
Numéro de téléphone : +33695637373
Adresse e-mail : fripants.contact@gmail.com
L'équipe Vinted`

const sample2 = `Bonjour nouvellerive,
Votre paiement a été reçu.
Reçu pour votre commande Vinted :

Vendeur	lisa_g41
Commande	Top ibiza

Montant payé	19,33 €
Article	15,00 €
Frais de port	2,88 €
Frais de Protection acheteurs	1,45 €

Mode de paiement	Apple Pay (19,33 €)
Date du paiement	26/05/2026 12 h 25
N° de transaction	20032426776

Nous vous enverrons un message...`

// Simulation HTML (corps d'un vrai mail Gmail Vinted)
const sample3Html = `<html><body>
<table><tr><td><strong>Vendeur</strong></td><td>fripants</td></tr>
<tr><td><strong>Commande</strong></td><td>Jean Twist Barrel Leg COS gris foncé / noir | W27</td></tr>
<tr><td><strong>Montant payé</strong></td><td>77,19&nbsp;€</td></tr>
<tr><td>Article</td><td>70,00&nbsp;€</td></tr>
<tr><td>Frais de port</td><td>2,99&nbsp;€</td></tr>
<tr><td>Frais de Protection acheteurs</td><td>4,20&nbsp;€</td></tr>
<tr><td><strong>Mode de paiement</strong></td><td>Apple Pay (77,19&nbsp;€)</td></tr>
<tr><td><strong>Date du paiement</strong></td><td>26/05/2026 11 h 52</td></tr>
<tr><td><strong>N° de transaction</strong></td><td>20032156409</td></tr>
</table></body></html>`

const expected = [
  {
    name: 'Sample 1 (texte, Jean COS)',
    body: sample1,
    expect: {
      vendeur: 'fripants',
      titre: 'Jean Twist Barrel Leg COS gris foncé / noir | W27',
      prixArticle: 70,
      fraisPort: 2.99,
      fraisProtection: 4.20,
      prixTotal: 77.19,
      modePaiement: 'Apple Pay',
      transactionId: '20032156409',
    },
  },
  {
    name: 'Sample 2 (texte, Top ibiza)',
    body: sample2,
    expect: {
      vendeur: 'lisa_g41',
      titre: 'Top ibiza',
      prixArticle: 15,
      fraisPort: 2.88,
      fraisProtection: 1.45,
      prixTotal: 19.33,
      modePaiement: 'Apple Pay',
      transactionId: '20032426776',
    },
  },
  {
    name: 'Sample 3 (HTML, Jean COS)',
    body: sample3Html,
    expect: {
      vendeur: 'fripants',
      titre: 'Jean Twist Barrel Leg COS gris foncé / noir | W27',
      prixArticle: 70,
      fraisPort: 2.99,
      fraisProtection: 4.20,
      prixTotal: 77.19,
      modePaiement: 'Apple Pay',
      transactionId: '20032156409',
    },
  },
]

let passed = 0
let failed = 0

for (const tc of expected) {
  const result = parseVintedReceipt(tc.body)
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
    console.log(`   docId Firestore: ${vintedDocId(result.transactionId)}`)
    console.log(`   dateAchat: ${result.dateAchat.toISOString()}`)
    passed++
  } else {
    console.log(`\n❌ ${tc.name}`)
    errors.forEach((e) => console.log(e))
    failed++
  }
}

// --- Test du payload mapper -----------------------------------------------

console.log(`\n${'─'.repeat(50)}\nPayload mapper\n${'─'.repeat(50)}`)

const receipt = parseVintedReceipt(sample1)
if (!receipt.ok) {
  console.log('❌ Impossible de parser sample1')
  failed++
} else {
  const payload = buildVintedProduitPayload(receipt, {
    chineuseNR: { uid: 'NR-uid-test', email: 'nouvelleriveparis@gmail.com' },
    sku: 'NR42',
  })
  const checks: Array<[string, unknown, unknown]> = [
    ['nom', payload.nom, 'NR42 - Jean Twist Barrel Leg COS gris foncé / noir | W27'],
    ['sku', payload.sku, 'NR42'],
    ['trigramme', payload.trigramme, 'NR'],
    ['chineurUid', payload.chineurUid, 'NR-uid-test'],
    ['source', payload.source, 'achat-vinted'],
    ['achatStatut', payload.achatStatut, 'commande'],
    ['achatOrderId', payload.achatOrderId, '20032156409'],
    ['achatVendeur', payload.achatVendeur, 'fripants'],
    ['achatTitreOriginal', payload.achatTitreOriginal, 'Jean Twist Barrel Leg COS gris foncé / noir | W27'],
    ['prixAchat', payload.prixAchat, 77.19],
    ['recu', payload.recu, false],
    ['vendu', payload.vendu, false],
    ['quantite', payload.quantite, 1],
    ['marque', payload.marque, ''],
    ['taille', payload.taille, ''],
    ['categorie', payload.categorie, ''],
  ]
  const errs = checks.filter(([, a, e]) => a !== e)
  if (errs.length === 0) {
    console.log(`\n✅ Payload Vinted Jean COS`)
    console.log(`   prixAchat=${payload.prixAchat}€ → suggestion vente=${suggestPrixVente(payload.prixAchat)}€`)
    passed++
  } else {
    console.log(`\n❌ Payload Vinted Jean COS`)
    errs.forEach(([k, a, e]) => console.log(`   ${k}: attendu ${JSON.stringify(e)}, reçu ${JSON.stringify(a)}`))
    failed++
  }
}

console.log(`\n${'='.repeat(50)}`)
console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
