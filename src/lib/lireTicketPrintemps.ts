// Lecture d'un ticket de caisse Printemps (texte OCR) → prix, date, canal.
// Repères observés sur les tickets du stand :
//   « GIGI PARIS / 0208 »            → VINTAGE (TVA 0)
//   « MOD GIGI PARIS / 461638001 »   → UPCYCLING (TVA 20 %)
// La date de vente est celle suivie de l'heure (« 01/08/2026 - 14:46:15 »),
// pas la « date limite d'échange » (qui tombe 30 jours après la vente).

export type Canal = 'VINTAGE' | 'UPCYCLING'
export type LigneTicket = { prix: number; canal: Canal }
// lignes : toutes les pièces du stand quand le ticket en porte plusieurs.
export type TicketLu = { prix?: number; dateVente?: string; canal?: Canal; lignes?: LigneTicket[] }

const montant = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))
// « 145,00 » ou « 1 250,00 », jamais collé à un code article (« 0208 95,00 »).
const MONTANT = String.raw`(?<![\d,.])(\d{1,3}(?: \d{3})*[,.]\d{2})(?!\d)`
const montants = (s: string) => Array.from(s.matchAll(new RegExp(MONTANT, 'g')), m => m[1])
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function lireDate(t: string, aujourdhui: Date): string | undefined {
  // Jour/mois fiables, année souvent mal lue (« 20 6 », « 2006 ») : on prend la
  // date passée la plus récente qui tombe ce jour-là. Le jour peut perdre un
  // chiffre (« 8/08/2026 »), l'heure être illisible : on se cale sur le tiret
  // ou l'heure qui suit, absents de la date d'échange.
  const d = t.match(/(?<!\d)(\d{1,2})[/.](\d{2})[/.]\s?\d[\d ]{1,4}?\s*(?:-|\d{2}[: ]\d{2})/)
  if (d && +d[2] >= 1 && +d[2] <= 12 && +d[1] >= 1 && +d[1] <= 31) {
    const v = new Date(aujourdhui.getFullYear(), +d[2] - 1, +d[1])
    if (v > aujourdhui) v.setFullYear(v.getFullYear() - 1)
    return iso(v)
  }
  // Sinon : date limite d'échange − 30 jours.
  const e = t.match(/chang[\s\S]{0,15}?(\d{2})[/.](\d{2})[/.](20\d{2})/i)
  if (e) {
    const v = new Date(+e[3], +e[2] - 1, +e[1] - 30)
    if (v <= aujourdhui) return iso(v)
  }
}

export function lireTicketPrintemps(texte: string, aujourdhui = new Date()): TicketLu {
  const t = texte.replace(/[ \t]+/g, ' ')
  const res: TicketLu = {}
  res.dateVente = lireDate(t, aujourdhui)

  const iTotal = t.search(/Total\s*pay/i)
  const avantTotal = iTotal > 0 ? t.slice(0, iTotal) : t

  // Tableau TVA : TTC à 0 % (vintage) et à 20 % (upcycling), plus fiable que
  // les lignes articles où un chiffre saute souvent.
  const ttc0 = t.match(/(?<![\d,])0,00\.?\s+0,00\s+(\d[\d ]*,\d{2})/)?.[1]
  const ttc20 = t.match(/(?<![\d,])20,00\.?\s+\d[\d ]*,\d{2}\s+(\d[\d ]*,\d{2})/)?.[1]

  // Lignes du stand : chaque « (MOD) GIGI PARIS » est une pièce ; son montant
  // est le premier entre ce repère et le suivant (il peut être illisible).
  const reperes = Array.from(avantTotal.matchAll(/(MOD\s*)?\S{0,4}\s?P\s?ARIS/gi))
  const lignes: LigneTicket[] = reperes.map((m, i) => {
    const fin = reperes[i + 1]?.index ?? avantTotal.length
    const brut = montants(avantTotal.slice(m.index! + m[0].length, Math.min(fin, m.index! + m[0].length + 60)))[0]
    return { prix: brut ? montant(brut) : 0, canal: (m[1] ? 'UPCYCLING' : 'VINTAGE') as Canal }
  })
  // Une seule pièce d'un canal → le TTC de ce taux corrige un chiffre mal lu
  // (« 95 » pour 85). Seulement si un seul chiffre diffère : une remise client
  // (Welcome Day, cagnotte) fait baisser le TTC sans changer le prix de la pièce.
  const unChiffre = (a: number, b: number) => {
    const x = a.toFixed(2), y = b.toFixed(2)
    return x.length === y.length && [...x].filter((c, i) => c !== y[i]).length === 1
  }
  for (const [canal, ttc] of [['VINTAGE', ttc0], ['UPCYCLING', ttc20]] as const) {
    const duCanal = lignes.filter(l => l.canal === canal)
    if (duCanal.length === 1 && ttc && (!duCanal[0].prix || unChiffre(duCanal[0].prix, montant(ttc)))) duCanal[0].prix = montant(ttc)
  }

  if (lignes.length >= 2) {
    // Plusieurs pièces : impossible de savoir laquelle on saisit → on propose.
    res.lignes = lignes.filter(l => l.prix > 0)
    return res
  }

  // Canal par le code article, sinon par la TVA (vintage = TVA à 0).
  const upcycling = /461638001|MOD\s*GIGI/i.test(t)
  const vintage = /\b0208\b/.test(t)
  if (upcycling !== vintage) res.canal = upcycling ? 'UPCYCLING' : 'VINTAGE'
  else if (/(?<![\d,])0,00\s+0,00/.test(t)) res.canal = 'VINTAGE'
  else if (/(?<![\d,])20,00\.?\s+\d/.test(t)) res.canal = 'UPCYCLING'

  // Prix d'une pièce seule : ligne article ou total, celui qui revient le plus
  // souvent sur le ticket (un chiffre mal lu n'apparaît qu'une fois).
  const articles = iTotal > 0 ? montants(t.slice(Math.max(0, t.search(/euros/i)), iTotal)) : []
  const total = iTotal > 0 ? montants(t.slice(iTotal, iTotal + 40))[0] : undefined
  const candidats = [lignes[0]?.prix && lignes[0].prix.toFixed(2).replace('.', ','), articles[0], total].filter(Boolean) as string[]
  const nb = (m: string) => t.split(m).length - 1
  const brut = candidats.sort((a, b) => nb(b) - nb(a))[0]
  if (brut && montant(brut) > 0) res.prix = montant(brut)

  return res
}
