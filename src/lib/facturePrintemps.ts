// Facture PRI (corner Printemps) : générateur séparé de la facture NR, qui ne
// bouge pas. Une ligne par canal, seul le net à devoir apparaît (le CA est
// encaissé par le Printemps, NR ne prend pas de commission).
//
// Vintage : le Printemps prélève 26 % HT du CA, soit 26 % × 1,2 TTC.
//   ex. CA 125 → com HT 32,50 → com TTC 39,00 → net 86,00
// Upcycling : le CA est TTC → CA HT = CA ÷ 1,2, le Printemps prélève 26 % du HT.
//   ex. CA TTC 120 → CA HT 100 → com 26 → net 74 (HT)
//
// TVA : selon la chineuse, pas selon sa fiche (CHB a un n° de TVA sans la facturer).
// Assujetties → +20 % sur toutes les lignes ; les autres → franchise (art. 293 B).
import jsPDF from 'jspdf'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { ChineuseMeta } from '@/components/SalesList'

export type VenteFacturePrintemps = { prix: number; canal: string; date: Date }
export type LigneFacturePrintemps = { libelle: string; net: number }

const COM_PRINTEMPS = 0.26
export const TRIGRAMMES_TVA_PRINTEMPS = ['IP']
export const MENTION_FRANCHISE = 'TVA non applicable, art. 293 B du CGI'
const arrondi = (n: number) => Math.round(n * 100) / 100
const fmtEUR = (n: number) => n.toFixed(2).replace('.', ',') + ' €'

export function lignesFacturePrintemps(ventes: VenteFacturePrintemps[]): LigneFacturePrintemps[] {
  const ca = (canal: string) => arrondi(ventes.filter(v => v.canal === canal).reduce((s, v) => s + v.prix, 0))
  const lignes: LigneFacturePrintemps[] = []
  const caVintage = ca('VINTAGE')
  if (caVintage > 0) {
    const comTTC = arrondi(arrondi(caVintage * COM_PRINTEMPS) * 1.2)
    lignes.push({ libelle: 'Lot de pièces vintage', net: arrondi(caVintage - comTTC) })
  }
  const caUpcyclingHT = arrondi(ca('UPCYCLING') / 1.2)
  if (caUpcyclingHT > 0) {
    const com = arrondi(caUpcyclingHT * COM_PRINTEMPS)
    lignes.push({ libelle: 'Lot de pièces upcyclées', net: arrondi(caUpcyclingHT - com) })
  }
  return lignes
}

export async function genererFacturePrintemps(params: {
  ventes: VenteFacturePrintemps[]
  chineuse: ChineuseMeta | null | undefined
  mois: string // « MM-AAAA »
}) {
  // Accents saisis en deux caractères (« e » + accent) : jsPDF ne sait pas les
  // afficher et espace alors toute la ligne → on les recompose (NFC).
  const ch = params.chineuse && Object.fromEntries(
    Object.entries(params.chineuse).map(([k, v]) => [k, typeof v === 'string' ? v.normalize('NFC') : v])
  ) as ChineuseMeta
  if (!ch?.codeChineuse) {
    alert("Aucune vente à facturer pour ce mois. En admin, choisis d'abord la chineuse dans « Je suis ».")
    return
  }
  const [m, y] = params.mois.split('-').map(Number)
  const start = new Date(y, m - 1, 1), end = new Date(y, m, 0, 23, 59, 59, 999)
  const lignes = lignesFacturePrintemps(params.ventes.filter(v => v.date >= start && v.date <= end))
  if (lignes.length === 0) {
    alert('Aucune vente à facturer pour ce mois.')
    return
  }
  const montantHT = arrondi(lignes.reduce((s, l) => s + l.net, 0))
  const assujettie = TRIGRAMMES_TVA_PRINTEMPS.includes(ch.codeChineuse.toUpperCase())
  const tva = assujettie ? arrondi(montantHT * 0.2) : 0
  const total = arrondi(montantHT + tva)
  const ref = `PRI${String(m).padStart(2, '0')}${String(y).slice(-2)}-${ch.codeChineuse.toUpperCase()}`
  const periode = format(start, 'LLLL yyyy', { locale: fr })
  const dateEmission = new Date()
  const dateEcheance = new Date(dateEmission); dateEcheance.setDate(dateEcheance.getDate() + 30)

  // En-tête identique à la facture NR : fiche de la chineuse à gauche, NR1 SAS à droite.
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 32, contentW = pageW - margin * 2, rightX = margin + contentW * (2 / 3) + 16
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text((ch.nom || '').toUpperCase(), margin, 52)
  doc.setFont('helvetica', 'normal')
  let yLeft = 68
  ;[ch.siret && `SIRET ${ch.siret}`, ch.adresse1, ch.adresse2, ch.tva && `TVA ${ch.tva}`].filter(Boolean).forEach(line => { doc.text(line as string, margin, yLeft); yLeft += 16 })
  doc.text('NR1 SAS', rightX, 52)
  doc.setTextColor(34, 32, 156); doc.text('941 895 203 00011', rightX, 68); doc.setTextColor(0, 0, 0)
  let yRight = 84
  ;['5 route du Grand Pont', '78110 Le Vésinet', 'FR5894189520'].forEach(t => { doc.text(t, rightX, yRight); yRight += 16 })
  const yMeta = Math.max(yLeft, yRight) + 24
  doc.text('Numéro de facture', margin, yMeta); doc.text(ref, margin + 110, yMeta)
  doc.text('Période', margin, yMeta + 16); doc.text(periode, margin + 110, yMeta + 16)
  doc.text('Date', margin, yMeta + 32); doc.text(format(dateEmission, 'dd/MM/yyyy'), margin + 110, yMeta + 32)
  doc.text('Échéance', margin, yMeta + 48); doc.text(format(dateEcheance, 'dd/MM/yyyy'), margin + 110, yMeta + 48)

  // Tableau : Descriptif | Net à nous devoir
  const yHead = yMeta + 78, hHead = 36
  doc.setFillColor(34, 32, 156); doc.rect(margin, yHead, contentW, hHead, 'F')
  doc.setTextColor(255, 255, 255)
  doc.text('Descriptif', margin + 8, yHead + 22)
  const titreNet = 'Net à nous devoir'
  doc.text(titreNet, margin + contentW - 8 - doc.getTextWidth(titreNet), yHead + 22)
  doc.setTextColor(0, 0, 0)
  let yRow = yHead + hHead + 22
  lignes.forEach(l => {
    doc.text(l.libelle, margin + 8, yRow)
    const v = fmtEUR(l.net)
    doc.text(v, margin + contentW - 8 - doc.getTextWidth(v), yRow)
    yRow += 20
  })

  let yTot = yRow + 22
  if (assujettie) {
    doc.text('Montant HT', margin, yTot); doc.text(fmtEUR(montantHT), margin + 160, yTot)
    doc.text('TVA 20%', margin, yTot + 18); doc.text(fmtEUR(tva), margin + 160, yTot + 18)
    doc.text('Total TTC', margin, yTot + 36); doc.text(fmtEUR(total), margin + 160, yTot + 36)
    yTot += 60
  }
  doc.setFont('helvetica', 'bold')
  doc.text('Net à reverser', margin, yTot); doc.text(fmtEUR(total), margin + 160, yTot)
  doc.setFont('helvetica', 'normal')
  if (!assujettie) { yTot += 20; doc.setFontSize(9); doc.text(MENTION_FRANCHISE, margin, yTot); doc.setFontSize(10) }
  const yBank = yTot + 40
  doc.text('IBAN', margin, yBank); doc.text(ch.iban || 'xxx', margin + 120, yBank)
  doc.text('BIC', margin, yBank + 16); doc.text(ch.bic || 'xxx', margin + 120, yBank + 16)
  doc.text('Adresse Banque', margin, yBank + 32)
  doc.text(doc.splitTextToSize(ch.banqueAdresse || 'xxx', contentW - 120), margin + 120, yBank + 32)

  // Factur-X : XML Printemps (lib/facturXPrintemps) joint côté serveur.
  const res = await fetch('/api/embed-facturx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdfBase64: doc.output('datauristring').split(',')[1],
      printemps: {
        ref,
        dateEmission: format(dateEmission, 'yyyy-MM-dd'),
        nom: ch.nom || '',
        siret: ch.siret,
        tva: ch.tva,
        iban: ch.iban,
        periode,
        lignes,
        assujettie,
      },
    }),
  })
  if (!res.ok) { alert('Erreur Factur-X'); return }
  const { pdfBase64 } = await res.json()
  const bytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `facture_${ref}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
