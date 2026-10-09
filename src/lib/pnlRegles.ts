// src/lib/pnlRegles.ts
// Règles de tri des transactions bancaires : « si le libellé contient X,
// alors catégorie Y ». Elles vivent chez nous (Firestore siteConfig/_pnlRegles),
// pas dans Pennylane — deux moteurs de règles finiraient par se contredire.

export type Regle = {
  id: string
  motif: string                       // texte cherché dans le libellé, insensible à la casse
  categorieId: number                 // catégorie Pennylane
  categorieLabel: string              // recopié pour l'affichage, Pennylane reste la source
  sens: 'cash_in' | 'cash_out' | null // null = les deux
  actif: boolean
  creeLe: string
}

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

export const sensDe = (montant: number): 'cash_in' | 'cash_out' => (montant >= 0 ? 'cash_in' : 'cash_out')

// Première règle qui matche, dans l'ordre de la liste.
export function trouverRegle(regles: Regle[], label: string, montant: number): Regle | null {
  const libelle = normaliserLibelle(label)
  const sens = sensDe(montant)
  for (const r of regles) {
    if (!r.actif) continue
    if (r.sens && r.sens !== sens) continue
    if (libelle.includes(r.motif.toUpperCase())) return r
  }
  return null
}
