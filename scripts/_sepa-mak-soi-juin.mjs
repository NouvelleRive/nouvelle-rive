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

const targets = ['MAK', 'SOI']
const rows = []

for (const tri of targets) {
  const chSnap = await db.collection('chineuse').where('trigramme', '==', tri).limit(1).get()
  if (chSnap.empty) { console.error(`Pas de chineuse pour ${tri}`); continue }
  const ch = { id: chSnap.docs[0].id, ...chSnap.docs[0].data() }

  const vsRaw = await db.collection('ventes').where('trigramme', '==', tri).get()
  const vs = vsRaw.docs.filter(d => {
    const dt = d.data().dateVente?.toDate?.()
    return dt && dt >= start && dt <= end
  })
  const ca = vs.reduce((s, d) => {
    const v = d.data()
    return s + (typeof v.prixVenteReel === 'number' ? v.prixVenteReel : (v.prix || 0))
  }, 0)
  const taux = typeof ch.taux === 'number' ? ch.taux / 100 : 0.40
  const commissionHT = ca * taux
  const tva = commissionHT * 0.2
  const commissionTTC = commissionHT * 1.2
  const net = ca - commissionTTC
  const ref = `NR0626-${tri}`

  console.log(`${tri} (${ch.nom || ch.email}) — ${vs.length} ventes / CA ${ca}€ — taux ${Math.round(taux*100)}% — net ${net.toFixed(2)}€ — IBAN ${ch.iban || '❌ MANQUANT'}`)
  rows.push({ ch, ca, net, tva, ref })
}

// Génération XML SEPA — même schéma que la page paiements
const now = new Date()
const msgId = `NR-${MOIS}-${now.getTime()}`
const dateISO = now.toISOString().split('.')[0]
const dateExec = now.toISOString().split('T')[0]
const totalAmount = rows.reduce((s, r) => s + r.net, 0)

const stripAccents = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')

const transactions = rows.map(({ ch, net, ref }) => {
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
      <NbOfTxs>${rows.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>NR1 SAS</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${msgId}-001</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${rows.length}</NbOfTxs>
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

const out = `/tmp/virements_mak-soi_${MOIS}.xml`
fs.writeFileSync(out, xml)
console.log(`\n✅ XML écrit : ${out}`)
console.log(`Total virement : ${totalAmount.toFixed(2)}€ (${rows.length} lignes)`)

process.exit(0)
