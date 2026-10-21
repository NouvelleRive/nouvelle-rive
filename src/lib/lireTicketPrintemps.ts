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

export function lireTicketPrintemps(texte: string): TicketLu {
  const t = texte.replace(/[ \t]+/g, ' ')
  const res: TicketLu = {}

  // Année hors de l'année en cours / précédente = chiffre mal lu → on laisse vide.
  const d = t.match(/(\d{2})[/.](\d{2})[/.](\d{4})\s*-?\s*\d{2}[: ]\d{2}/)
  const annee = new Date().getFullYear()
  if (d && +d[3] >= annee - 1 && +d[3] <= annee && +d[2] >= 1 && +d[2] <= 12 && +d[1] >= 1 && +d[1] <= 31) {
    res.dateVente = `${d[3]}-${d[2]}-${d[1]}`
  }

  const upcycling = /461638001|MOD\s*GIGI/i.test(t)
  const vintage = /\b0208\b/.test(t)
  if (upcycling !== vintage) res.canal = upcycling ? 'UPCYCLING' : 'VINTAGE'

  // Premier montant après « GIGI PARIS » = la pièce du stand (un ticket peut
  // porter d'autres marques, et le code article est souvent mal lu) ;
  // sinon le total payé.
  const ligne = t.match(new RegExp(`PARIS[\\s\\S]{0,60}?${MONTANT}`, 'i'))
  const total = t.match(new RegExp(`Total\\s*pay[ée]\\s*${MONTANT}`, 'i'))
  const brut = ligne?.[1] || total?.[1]
  if (brut && montant(brut) > 0) res.prix = montant(brut)

  return res
}
