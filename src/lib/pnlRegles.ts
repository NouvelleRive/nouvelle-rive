// src/lib/pnlRegles.ts
// Règles de tri des transactions bancaires : « si le libellé contient X,
// alors catégorie Y ». Elles vivent chez nous (Firestore siteConfig/_pnlRegles),
// pas dans Pennylane — deux moteurs de règles finiraient par se contredire.

// Une règle vise soit un compte comptable (l'affectation, ce qui compte pour le
// P&L), soit une catégorie analytique Pennylane, soit les deux.
export type Regle = {
  id: string
  // 'transaction' : relevé bancaire → catégorie ou compte.
  // 'ecriture'    : facture déjà comptabilisée dont une ligne est sur le mauvais
  //                 compte (compteSource) et doit basculer sur `compte`.
  portee?: 'transaction' | 'ecriture'
  compteSource?: string
  motif: string                       // texte cherché dans le libellé, insensible à la casse
  compte?: string                     // n° de compte comptable, ex. 511301
  compteLabel?: string
  categorieId?: number                // catégorie Pennylane
  categorieLabel?: string
  sens: 'cash_in' | 'cash_out' | null // null = les deux
  actif: boolean
  creeLe: string
}

export const cibleDe = (r: Regle) =>
  r.compte ? `${r.compte} ${r.compteLabel || ''}`.trim() : (r.categorieLabel || '—')

// Les libellés bancaires sont bruités : retours à la ligne, préfixes SEPA,
// références de virement. On normalise pour regrouper ce qui se ressemble.
export function normaliserLibelle(label: string | null | undefined): string {
  let s = (label || '').replace(/\s+/g, ' ').trim().toUpperCase()
  s = s.replace(/^-\s*/, '')
  s = s.replace(/\bNC\s*-\s*CREDITOR/, 'CREDITOR')
  s = s.replace(/CREDITOR NAME SEPA\s*:/g, 'SEPA')
  s = s.replace(/\bREF[-A-Z0-9]{6,}\b/g, '')
  s = s.replace(/\b[A-Z]{0,4}\d[A-Z0-9]{4,}\b/g, '') // références type NR0126MAK
  s = s.replace(/\s*-\s*$/, '')
  return s.replace(/\s+/g, ' ').trim()
}

// Libellé d'une facture comptabilisée : pas de bruit SEPA ni de référence de
// virement à retirer, mais des accents et des apostrophes qui empêchent un
// motif simple de matcher (TÊTE D'ORANGE vs TETE D ORANGE).
export function normaliserLibelleEcriture(label: string | null | undefined): string {
  const sansAccents = (label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return sansAccents
    .toUpperCase()
    .replace(/\(LABEL GENERE\)/g, '')
    .replace(/[^A-Z0-9 .-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const sensDe = (montant: number): 'cash_in' | 'cash_out' => (montant >= 0 ? 'cash_in' : 'cash_out')

// Première règle qui matche, dans l'ordre de la liste.
export function trouverRegle(regles: Regle[], label: string, montant: number): Regle | null {
  const libelle = normaliserLibelle(label)
  const sens = sensDe(montant)
  for (const r of regles) {
    if (!r.actif) continue
    if ((r.portee ?? 'transaction') !== 'transaction') continue
    if (r.sens && r.sens !== sens) continue
    if (libelle.includes(r.motif.toUpperCase())) return r
  }
  return null
}

// Règles d'écriture : le libellé d'une facture déjà comptabilisée. On prend le
// motif le plus long qui matche, pour qu'un alias précis l'emporte sur un nom
// de marque générique.
export function trouverRegleEcriture(regles: Regle[], label: string, compteSource: string): Regle | null {
  const l = normaliserLibelleEcriture(label)
  const candidates = regles.filter(r =>
    r.actif &&
    r.portee === 'ecriture' &&
    (r.compteSource || '') === compteSource &&
    l.includes(r.motif.toUpperCase()))
  return candidates.sort((a, b) => b.motif.length - a.motif.length)[0] || null
}

// Les libellés bancaires sont illisibles (et exposent des noms de personnes).
// On affiche un nom métier en français ; le libellé brut reste en survol.
const LIBELLES_LISIBLES: { motif: string; lisible: string }[] = [
  { motif: 'SQUAREUP', lisible: "Volume d'affaires" },
]

export function libelleLisible(libelleNormalise: string): string | null {
  const l = (libelleNormalise || '').toUpperCase()
  return LIBELLES_LISIBLES.find(x => l.includes(x.motif))?.lisible ?? null
}
