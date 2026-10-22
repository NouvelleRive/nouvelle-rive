// XML Factur-X de la facture PRI (corner Printemps). Séparé du XML NR.
// Une ligne par lot (vintage / upcyclé), montant = net à devoir.
// TVA : chineuse assujettie → catégorie S 20 % ; sinon franchise en base
// → catégorie E avec le motif « art. 293 B du CGI ».

export type FacturXPrintemps = {
  ref: string
  dateEmission: string // yyyy-MM-dd
  nom: string
  siret?: string
  tva?: string
  iban?: string
  periode: string
  lignes: { libelle: string; net: number }[]
  assujettie: boolean
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function genererXMLPrintemps(d: FacturXPrintemps): string {
  const dateStr = d.dateEmission.replace(/-/g, '')
  const due = new Date(d.dateEmission); due.setDate(due.getDate() + 30)
  const dueStr = due.toISOString().slice(0, 10).replace(/-/g, '')
  const siret = d.siret?.replace(/\s/g, '') || ''
  const iban = d.iban?.replace(/\s/g, '') || ''
  const tva = d.tva?.replace(/\s/g, '').toUpperCase() || ''
  const tvaValide = /^[A-Z]{2}[0-9A-Z]{8,13}$/.test(tva)
  const ht = Math.round(d.lignes.reduce((s, l) => s + l.net, 0) * 100) / 100
  const tvaMontant = d.assujettie ? Math.round(ht * 20) / 100 : 0
  const totalHT = ht.toFixed(2)
  const totalTTC = (ht + tvaMontant).toFixed(2)
  const categorie = d.assujettie
    ? '<ram:CategoryCode>S</ram:CategoryCode>\n          <ram:RateApplicablePercent>20</ram:RateApplicablePercent>'
    : '<ram:CategoryCode>E</ram:CategoryCode>\n          <ram:RateApplicablePercent>0</ram:RateApplicablePercent>'

  const lignes = d.lignes.map((l, i) => `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>${xml(l.libelle)} - ${xml(d.periode)}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice><ram:ChargeAmount>${l.net.toFixed(2)}</ram:ChargeAmount></ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">1</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          ${categorie}
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${l.net.toFixed(2)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:factur-x.eu:1p0:en16931</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${xml(d.ref)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${dateStr}</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lignes}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${xml(d.nom)}</ram:Name>
        ${siret ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${siret}</ram:ID></ram:SpecifiedLegalOrganization>` : ''}
        ${tvaValide ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${tva}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>NR1 SAS</ram:Name>
        <ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">94189520300011</ram:ID></ram:SpecifiedLegalOrganization>
      </ram:BuyerTradeParty>
      <ram:BuyerReference>NR1 SAS - Nouvelle Rive - Printemps</ram:BuyerReference>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      ${iban ? `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${iban}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>` : ''}
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${tvaMontant.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        ${d.assujettie ? '' : '<ram:ExemptionReason>TVA non applicable, art. 293 B du CGI</ram:ExemptionReason>'}
        <ram:BasisAmount>${totalHT}</ram:BasisAmount>
        ${d.assujettie ? '<ram:CategoryCode>S</ram:CategoryCode>' : '<ram:CategoryCode>E</ram:CategoryCode>\n        <ram:ExemptionReasonCode>VATEX-FR-FRANCHISE</ram:ExemptionReasonCode>'}
        <ram:RateApplicablePercent>${d.assujettie ? 20 : 0}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime><udt:DateTimeString format="102">${dueStr}</udt:DateTimeString></ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${totalHT}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${totalHT}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${tvaMontant.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${totalTTC}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${totalTTC}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
}
