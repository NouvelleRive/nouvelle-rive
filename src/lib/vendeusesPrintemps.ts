// Vendeuses du Printemps : numéro « Opérateur » imprimé sur le ticket → prénom.
// Table à compléter au fil de l'eau. Un même numéro peut revenir pour deux
// personnes : dans ce cas le ticket ne préremplit pas, on choisit à la main.
export const OPERATEURS_PRINTEMPS: Array<{ code: string; nom: string }> = [
  { code: '11842', nom: 'Estelle' },
  { code: '107225', nom: 'Steve' },
  { code: '105885', nom: 'Paul' },
  { code: '98635', nom: 'Nas' },
  { code: '107305', nom: 'Anna' },
  { code: '109056', nom: 'Malo' },
  { code: '109169', nom: 'Altesse' },
  { code: '109068', nom: 'Tess' },
  { code: '112692', nom: 'Yoan' },
  { code: '116730', nom: 'Ursula' },
  { code: '122372', nom: 'Leslie' },
  { code: '115374', nom: 'Constance' },
  { code: '121165', nom: 'Kimia' },
]

// Vendeuses sans code caisse : seulement dans la liste déroulante.
export const VENDEUSES_SANS_CODE = ['Salomé', 'Ines', 'Sarah', 'Alexia']

export const VENDEUSES_PRINTEMPS = Array.from(new Set([...OPERATEURS_PRINTEMPS.map(o => o.nom), ...VENDEUSES_SANS_CODE]))
  .sort((a, b) => a.localeCompare(b, 'fr'))

// Vendeuse d'un numéro opérateur, seulement s'il n'y en a qu'une.
export function vendeuseDuCode(code?: string): string | undefined {
  if (!code) return
  const noms = OPERATEURS_PRINTEMPS.filter(o => o.code === code).map(o => o.nom)
  return noms.length === 1 ? noms[0] : undefined
}

// Libellé du menu : « Nas · 98635 », juste le prénom pour les sans-code.
export function libelleVendeuse(nom: string): string {
  const codes = OPERATEURS_PRINTEMPS.filter(o => o.nom === nom).map(o => o.code)
  return codes.length ? `${nom} · ${codes.join(', ')}` : nom
}
