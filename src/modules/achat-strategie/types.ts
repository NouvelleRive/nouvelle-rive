// Module STRATÉGIE D'ACHAT — types & logique d'évaluation (pure, sans Firestore).
//
// L'acheteuse définit un objectif d'assortiment : un nombre de pièces cible +
// des règles « X % de pièces de tel type ». L'app compare le réalisé (ses pièces
// ACH) à cet objectif et signale ce qu'il faut restocker.
//
// Brique découpable : aucune dépendance Firestore ici. L'API `/api/acheteuse/
// strategie` fournit les produits (depuis le cache blob) et appelle `evaluer`.

/** Axes disponibles pour une règle, mappés sur les champs produit existants. */
export type AxisKey =
  | 'color'         // couleur
  | 'categorie'     // catégorie (label Square)
  | 'marque'        // marque
  | 'modele'        // modèle / coupe (ex: Blazer, Oversized, Court, Long, Y2K, Manches courtes…)
  | 'motif'         // motif
  | 'closureType'   // type de fermeture
  | 'prix'          // fourchette de prix de vente (match = "min-max")

export const AXIS_LABELS: Record<AxisKey, string> = {
  color: 'Couleur',
  categorie: 'Catégorie',
  marque: 'Marque',
  modele: 'Modèle',
  motif: 'Motif',
  closureType: 'Fermeture',
  prix: 'Prix (min-max €)',
}

/** Une règle d'objectif : « `targetPct` % de pièces qui matchent `match` sur `axis` ». */
export type StrategieRule = {
  id: string
  /** Libellé libre affiché (ex: « Vestes courtes »). */
  label: string
  axis: AxisKey
  /** Valeur à matcher (insensible à la casse, sous-chaîne). Pour `prix` : "min-max". */
  match: string
  /** Objectif en % du nombre de pièces cible. */
  targetPct: number
}

export type StrategieObjectif = {
  /** Nombre de pièces cible (dénominateur des pourcentages). */
  cibleStock: number
  rules: StrategieRule[]
}

export const OBJECTIF_VIDE: StrategieObjectif = { cibleStock: 0, rules: [] }

/** Produit minimal nécessaire à l'évaluation (sous-ensemble des champs `produits`). */
export type StrategieProduit = {
  color?: string | null
  categorie?: string | null
  marque?: string | null
  modele?: string | null
  motif?: string | null
  garmentLength?: string | null
  sleeveLength?: string | null
  closureType?: string | null
  prix?: number | null
  vendu?: boolean
  achatStatut?: string
}

/** Un produit matche-t-il une règle ? */
export function matchRule(p: StrategieProduit, rule: StrategieRule): boolean {
  if (rule.axis === 'prix') {
    const prix = typeof p.prix === 'number' ? p.prix : NaN
    if (!Number.isFinite(prix)) return false
    const [minRaw, maxRaw] = rule.match.split('-').map(s => s.trim())
    const min = parseFloat(minRaw)
    const max = maxRaw ? parseFloat(maxRaw) : Infinity
    if (!Number.isFinite(min)) return false
    return prix >= min && prix < (Number.isFinite(max) ? max : Infinity)
  }
  const field = (p as any)[rule.axis]
  if (typeof field !== 'string' || !field.trim()) return false
  const needle = rule.match.trim().toLowerCase()
  if (!needle) return false
  return field.toLowerCase().includes(needle)
}

export type RuleResult = StrategieRule & {
  /** Nombre de pièces (commandées) qui matchent. */
  count: number
  /** % réalisé = count / cibleStock × 100. */
  actualPct: number
  /** Remplissage de jauge = actualPct / targetPct, borné à [0, 1] pour l'affichage. */
  fill: number
  /** true si en-dessous de l'objectif → à restocker. */
  underTarget: boolean
  /** Nombre de pièces manquantes pour atteindre l'objectif. */
  manque: number
}

export type StrategieRealise = {
  cible: number
  commandees: number
  enSurface: number
  rules: RuleResult[]
  /** Règles sous objectif, triées par manque décroissant (notifs restock). */
  aRestocker: RuleResult[]
}

/** Une pièce est-elle « en surface » = reçue boutique et pas encore vendue. */
export function estEnSurface(p: StrategieProduit): boolean {
  return p.achatStatut === 'recu-boutique' && !p.vendu
}

/**
 * Évalue le réalisé d'un lot de pièces ACH contre un objectif.
 * @param produits toutes les pièces du trigramme ACH (commandées)
 */
export function evaluer(objectif: StrategieObjectif, produits: StrategieProduit[]): StrategieRealise {
  const cible = Math.max(0, Math.round(objectif.cibleStock || 0))
  const commandees = produits.length
  const enSurface = produits.filter(estEnSurface).length
  const denom = cible > 0 ? cible : commandees // fallback : si pas de cible, base sur le commandé

  const rules: RuleResult[] = (objectif.rules || []).map(rule => {
    const count = produits.filter(p => matchRule(p, rule)).length
    const actualPct = denom > 0 ? Math.round((count / denom) * 100) : 0
    const target = Math.max(0, rule.targetPct || 0)
    const fill = target > 0 ? Math.min(1, actualPct / target) : (count > 0 ? 1 : 0)
    const objCount = Math.round((target / 100) * denom)
    const manque = Math.max(0, objCount - count)
    return { ...rule, count, actualPct, fill, underTarget: manque > 0, manque }
  })

  const aRestocker = rules
    .filter(r => r.underTarget)
    .sort((a, b) => b.manque - a.manque)

  return { cible, commandees, enSurface, rules, aRestocker }
}
