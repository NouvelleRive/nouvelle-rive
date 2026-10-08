// Coûts de vente — constantes de référence pour le P&L.
//
// Tout ce qui chiffre le coût d'une vente (bonus vendeuse, frais de paiement,
// fixe vendeuse au SMIC) vit ici : une seule source de vérité, modifiable sans
// toucher aux écrans.
//
// Les valeurs du SMIC sont DATÉES : un mois passé garde le taux qui
// s'appliquait à l'époque, l'historique ne bouge jamais.

/** Bonus vendeuse : 1 % du CA. */
export const TAUX_BONUS_VENDEUSE = 0.01

/** Frais d'encaissement (Square/CB) : 0,5 % du CA. */
export const TAUX_FRAIS_PAIEMENT = 0.005

/** Jours de vendeuse imputés au stock acheté, par mois. */
export const FIXE_VENDEUSE_JOURS = 2
/** Heures par jour travaillé. */
export const FIXE_VENDEUSE_HEURES_PAR_JOUR = 7

/**
 * Charges patronales résiduelles au niveau du SMIC, après la réduction générale
 * dégressive unique (RGDU, en vigueur depuis le 01/01/2026) : ~6 % du brut pour
 * une entreprise de moins de 50 salarié·es.
 */
export const TAUX_CHARGES_PATRONALES_SMIC = 0.06

/**
 * SMIC horaire brut par période (`depuis` au format `yyyy-MM-dd`, ordre
 * croissant). Ajouter une ligne à chaque revalorisation — ne jamais modifier
 * les lignes passées.
 */
export const SMIC_HORAIRE_BRUT: { depuis: string; taux: number }[] = [
  { depuis: '2024-11-01', taux: 11.88 },
  { depuis: '2026-01-01', taux: 12.02 },
  { depuis: '2026-06-01', taux: 12.31 },
]

/** SMIC horaire brut applicable à une date (`yyyy-MM-dd`). */
export function smicHoraireBrut(dateStr: string): number {
  let taux = SMIC_HORAIRE_BRUT[0].taux
  for (const p of SMIC_HORAIRE_BRUT) {
    if (p.depuis <= dateStr) taux = p.taux
  }
  return taux
}

/**
 * Coût employeur du fixe vendeuse pour un mois donné :
 * 2 jours × 7 h × SMIC horaire brut × (1 + charges patronales).
 * @param dateStr une date du mois concerné (`yyyy-MM-dd`)
 */
export function fixeVendeuseMensuel(dateStr: string): number {
  const heures = FIXE_VENDEUSE_JOURS * FIXE_VENDEUSE_HEURES_PAR_JOUR
  const brut = heures * smicHoraireBrut(dateStr)
  return Math.round(brut * (1 + TAUX_CHARGES_PATRONALES_SMIC))
}
