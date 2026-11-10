// Cycle de rotation des pièces chineuses en boutique (source unique de vérité).
// - < 1 mois de présence : un changement de prix = simple réajustement (pas de chrono)
// - ≥ 1 mois : une baisse = baisse officielle (prixBaisseLe) → bleu pendant 1 mois
// - orange (prix à baisser) : ≥ 2 mois sans baisse, OU dernière baisse il y a +1 mois
// - rouge (à récupérer) : ≥ 3 mois de présence, sans exception
// Un mail informatif part à 1 mois (cron reminders) : « baisser maintenant ou attendre un mois ».

export type EtatCycle = 'none' | 'orange' | 'blue' | 'red'

export function moisAvant(n: number, ref: Date = new Date()): Date {
  const d = new Date(ref)
  d.setMonth(d.getMonth() - n)
  return d
}

const toDate = (v: any): Date | undefined => {
  if (!v) return undefined
  if (v instanceof Date) return v
  if (typeof v.toDate === 'function') return v.toDate()
  return undefined
}

/** Une baisse de prix sur cette pièce compte-t-elle comme baisse officielle ? */
export function baisseOfficielleEligible(dateReception: any, now: Date = new Date()): boolean {
  const dr = toDate(dateReception)
  return !!dr && dr < moisAvant(1, now)
}

export function etatCycle(dateReception: any, prixBaisseLe: any, now: Date = new Date()): EtatCycle {
  const dr = toDate(dateReception)
  if (!dr) return 'none'
  if (dr < moisAvant(3, now)) return 'red'
  const bd = toDate(prixBaisseLe)
  if (bd && bd >= moisAvant(1, now)) return 'blue'
  if (dr < moisAvant(2, now)) return 'orange'
  return bd ? 'blue' : 'none'
}

/** Date à laquelle la pièce passera en orange (pour les rappels J-10 / J-7). */
export function pivotOrange(dateReception: any, prixBaisseLe: any): Date | null {
  const dr = toDate(dateReception)
  if (!dr) return null
  const p = new Date(dr); p.setMonth(p.getMonth() + 2)
  const bd = toDate(prixBaisseLe)
  if (bd) {
    const pb = new Date(bd); pb.setMonth(pb.getMonth() + 1)
    if (pb > p) return pb
  }
  return p
}

/** Date à laquelle la pièce passera en rouge (3 mois de présence). */
export function pivotRouge(dateReception: any): Date | null {
  const dr = toDate(dateReception)
  if (!dr) return null
  const p = new Date(dr); p.setMonth(p.getMonth() + 3)
  return p
}
