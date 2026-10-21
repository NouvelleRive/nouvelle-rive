// Lecture d'un ticket de caisse Printemps (texte OCR) → prix, date, canal.
// Repères observés sur les tickets du stand :
//   « GIGI PARIS / 0208 »            → VINTAGE (TVA 0)
//   « MOD GIGI PARIS / 461638001 »   → UPCYCLING (TVA 20 %)
// La date de vente est celle suivie de l'heure (« 01/08/2026 - 14:46:15 »),
// pas la « date limite d'échange ».

export type TicketLu = { prix?: number; dateVente?: string; canal?: 'VINTAGE' | 'UPCYCLING' }

const montant = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))
// « 145,00 » ou « 1 250,00 », jamais collé à un code article (« 0208 95,00 »).
const MONTANT = String.raw`(?<![\d,.])(\d{1,3}(?: \d{3})*[,.]\d{2})(?!\d)`
const montants = (s: string) => Array.from(s.matchAll(new RegExp(MONTANT, 'g')), m => m[1])
const pad = (n: number) => String(n).padStart(2, '0')

export function lireTicketPrintemps(texte: string, aujourdhui = new Date()): TicketLu {
  const t = texte.replace(/[ \t]+/g, ' ')
  const res: TicketLu = {}

  // Jour/mois fiables, année souvent mal lue (« 20 6 », « 2006 ») : on prend la
  // date passée la plus récente qui tombe ce jour-là.
  // Le jour peut perdre un chiffre (« 8/08/2026 »), l'heure être illisible :
  // on se cale sur le tiret ou l'heure qui suit, absents de la date d'échange.
  const d = t.match(/(?<!\d)(\d{1,2})[/.](\d{2})[/.]\s?\d[\d ]{1,4}?\s*(?:-|\d{2}[: ]\d{2})/)
  if (d && +d[2] >= 1 && +d[2] <= 12 && +d[1] >= 1 && +d[1] <= 31) {
    let annee = aujourdhui.getFullYear()
    if (new Date(annee, +d[2] - 1, +d[1]) > aujourdhui) annee--
    res.dateVente = `${annee}-${pad(+d[2])}-${pad(+d[1])}`
  }

  // Canal par le code article, sinon par la TVA (vintage = TVA à 0).
  const upcycling = /461638001|MOD\s*GIGI/i.test(t)
  const vintage = /\b0208\b/.test(t)
  if (upcycling !== vintage) res.canal = upcycling ? 'UPCYCLING' : 'VINTAGE'
  else if (/(?<![\d,])0,00\s+0,00/.test(t)) res.canal = 'VINTAGE'
  else if (/(?<![\d,])20,00\.?\s+\d/.test(t)) res.canal = 'UPCYCLING'

  // Prix : les lignes articles sont entre l'en-tête et « Total payé ».
  //  - plusieurs articles (autre marque sur le ticket) → la ligne GIGI PARIS ;
  //  - un seul → article ou total, celui qui revient le plus souvent sur le
  //    ticket (un chiffre mal lu n'apparaît qu'une fois, le bon se retrouve
  //    dans la ligne TVA).
  const iTotal = t.search(/Total\s*pay/i)
  const iDebut = t.search(/euros/i)
  const articles = iTotal > 0 ? montants(t.slice(Math.max(0, iDebut), iTotal)) : []
  const total = iTotal > 0 ? montants(t.slice(iTotal, iTotal + 40))[0] : undefined
  let brut: string | undefined
  if (articles.length >= 2) {
    const gigi = t.slice(0, iTotal).match(new RegExp(`P\\s?ARIS[\\s\\S]{0,60}?${MONTANT}`, 'i'))
    brut = gigi?.[1] || articles[0]
  } else if (articles.length === 1 && total && articles[0] !== total) {
    const nb = (m: string) => t.split(m).length - 1
    brut = nb(total) > nb(articles[0]) ? total : articles[0]
  } else {
    // « Total payé » illisible → premier montant après GIGI PARIS.
    brut = articles[0] || total || t.match(new RegExp(`P\\s?ARIS[\\s\\S]{0,60}?${MONTANT}`, 'i'))?.[1]
  }
  if (brut && montant(brut) > 0) res.prix = montant(brut)

  return res
}
