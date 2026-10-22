// XML Factur-X de la facture PRI (corner Printemps). Séparé du XML NR.
// Une ligne par lot (vintage / upcyclé), montant = net à devoir.
// TVA : règle Printemps à venir → en attendant, lignes en catégorie Z (0 %).

export type FacturXPrintemps = {
  ref: string
  dateEmission: string // yyyy-MM-dd
  nom: string
  siret?: string
  tva?: string
  iban?: string
  periode: string
  lignes: { libelle: string; net: number }[]
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
  const total = d.lignes.reduce((s, l) => s + l.net, 0).toFixed(2)

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
          <ram:CategoryCode>Z</ram:CategoryCode>
          <ram:RateApplicablePercent>0</ram:RateApplicablePercent>
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
        <ram:CalculatedAmount>0.00</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${total}</ram:BasisAmount>
        <ram:CategoryCode>Z</ram:CategoryCode>
        <ram:RateApplicablePercent>0</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime><udt:DateTimeString format="102">${dueStr}</udt:DateTimeString></ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${total}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${total}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">0.00</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${total}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${total}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
}
