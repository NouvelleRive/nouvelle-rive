// Virements SEPA (pain.001.001.03) depuis le compte NR1 SAS : export NR et export PRI
// de la page Paiements.

export type VirementSepa = { ref: string; montant: number; iban: string; bic?: string; nom: string }

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

export function genererSepaXml(msgId: string, virements: VirementSepa[], now = new Date()): string {
  const dateISO = now.toISOString().split('.')[0]
  const totalAmount = virements.reduce((s, v) => s + v.montant, 0)

  const transactions = virements.map((v) => {
    const iban = (v.iban || '').replace(/\s/g, '')
    const bic = (v.bic || '').replace(/\s/g, '')
    const nom = sansAccents(v.nom || '').slice(0, 70)
    return `
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${v.ref}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="EUR">${v.montant.toFixed(2)}</InstdAmt>
        </Amt>
        ${bic ? `<CdtrAgt><FinInstnId><BIC>${bic}</BIC></FinInstnId></CdtrAgt>` : ''}
        <Cdtr>
          <Nm>${nom}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id><IBAN>${iban}</IBAN></Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${v.ref}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${dateISO}</CreDtTm>
      <NbOfTxs>${virements.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>NR1 SAS</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${msgId}-001</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${virements.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${now.toISOString().split('T')[0]}</ReqdExctnDt>
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
}

export function telechargerXml(xml: string, nomFichier: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }))
  link.download = nomFichier
  link.click()
  URL.revokeObjectURL(link.href)
}
