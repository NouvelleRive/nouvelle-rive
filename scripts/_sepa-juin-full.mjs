import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
import fs from 'fs'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}
const db = getFirestore()

const MOIS = '06-2026'
const start = new Date(2026, 5, 1)
const end = new Date(2026, 6, 0, 23, 59, 59, 999)

// 1. Charger chineuses
const chSnap = await db.collection('chineuse').get()
const chineuses = chSnap.docs.map(d => ({ id: d.id, ...d.data() }))

// 2. Charger statuts paiements du mois
const statutsSnap = await db.collection('paiements').doc(MOIS).collection('statuts').get()
const statuts = {}
for (const d of statutsSnap.docs) statuts[d.id] = d.data()

// 3. Charger toutes les ventes du mois (une seule fois)
const ventesSnap = await db.collection('ventes').get()
const ventesJuin = ventesSnap.docs.filter(d => {
  const dt = d.data().dateVente?.toDate?.()
  return dt && dt >= start && dt <= end
}).map(d => ({ id: d.id, ...d.data() }))
console.log(`${ventesJuin.length} ventes juin chargées`)

// 4. Calculer paiement par chineuse (même logique que la page paiements)
const rows = []
for (const ch of chineuses) {
  const vs = ventesJuin.filter(v => v.chineur === ch.email || (ch.trigramme && v.trigramme === ch.trigramme))
  if (vs.length === 0) continue
  const ca = vs.reduce((s, v) => s + (typeof v.prixVenteReel === 'number' ? v.prixVenteReel : (v.prix || 0)), 0)
  const taux = typeof ch.taux === 'number' ? ch.taux / 100 : 0.40
  const commissionHT = ca * taux
  const commissionTTC = commissionHT * 1.2
  const net = ca - commissionTTC
  const ref = `NR0626-${(ch.trigramme || '').toUpperCase()}`
  rows.push({ ch, ca, net, ref, nbVentes: vs.length })
}

// 5. Filtre SEPA : facture reçue + non payé + IBAN
const aExporter = rows.filter(r => {
  const s = statuts[r.ch.id]
  return s?.factureRecue && !s?.paye && r.ch.iban
})

console.log(`\n${rows.length} chineuses avec ventes en juin`)
console.log(`${aExporter.length} éligibles SEPA (facture reçue + non payé + IBAN)\n`)
for (const r of aExporter) {
  console.log(`  ${(r.ch.trigramme||'?').padEnd(6)} ${(r.ch.nom||r.ch.email).padEnd(30)} — ${r.nbVentes} ventes / CA ${r.ca}€ → net ${r.net.toFixed(2)}€`)
}

// 6. Chineuses avec ventes MAIS non éligibles SEPA (facture pas reçue, ou déjà payé, ou pas d'IBAN)
console.log('\n--- Non exportées ---')
for (const r of rows.filter(r => !aExporter.includes(r))) {
  const s = statuts[r.ch.id] || {}
  const raisons = []
  if (!s.factureRecue) raisons.push('pas de facture')
  if (s.paye) raisons.push('déjà payé')
  if (!r.ch.iban) raisons.push('pas d\'IBAN')
  console.log(`  ${(r.ch.trigramme||'?').padEnd(6)} ${(r.ch.nom||r.ch.email).padEnd(30)} — net ${r.net.toFixed(2)}€ (${raisons.join(', ')})`)
}

if (aExporter.length === 0) {
  console.log('\n❌ Aucun paiement à exporter')
  process.exit(1)
}

// 7. Génération XML SEPA — même schéma que la page paiements
const now = new Date()
const msgId = `NR-${MOIS}-${now.getTime()}`
const dateISO = now.toISOString().split('.')[0]
const dateExec = now.toISOString().split('T')[0]
const totalAmount = aExporter.reduce((s, r) => s + r.net, 0)

const stripAccents = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')

const transactions = aExporter.map(({ ch, net, ref }) => {
  const iban = (ch.iban || '').replace(/\s/g, '')
  const bic = (ch.bic || '').replace(/\s/g, '')
  const nom = stripAccents(ch.raisonSociale || ch.nom || ch.email || '').slice(0, 70)
  return `
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${ref}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="EUR">${net.toFixed(2)}</InstdAmt>
        </Amt>
        ${bic ? `<CdtrAgt><FinInstnId><BIC>${bic}</BIC></FinInstnId></CdtrAgt>` : ''}
        <Cdtr>
          <Nm>${nom}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id><IBAN>${iban}</IBAN></Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${ref}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`
}).join('')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${dateISO}</CreDtTm>
      <NbOfTxs>${aExporter.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>NR1 SAS</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${msgId}-001</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${aExporter.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${dateExec}</ReqdExctnDt>
      <Dbtr>
        <Nm>NR1 SAS</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id><IBAN>FR7617418000010001189894769</IBAN></Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId><BIC>SNNNFR22XXX</BIC></FinInstnId>
      </DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>${transactions}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`

const out = `${process.env.HOME}/Downloads/virements_${MOIS}.xml`
fs.writeFileSync(out, xml)
console.log(`\n✅ XML écrit : ${out}`)
console.log(`Total virement : ${totalAmount.toFixed(2)}€ (${aExporter.length} lignes)`)

process.exit(0)
