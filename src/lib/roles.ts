// src/lib/roles.ts
// Source unique des rôles Nouvelle Rive (email → rôle) + destination de connexion.
//
// Historiquement les emails de rôle sont dupliqués dans ~30 fichiers (pas de
// refacto de masse ici, cf. règle "pas de bazooka"). Ce fichier est le point
// d'entrée pour tout NOUVEAU code — en particulier le module ACHETEUSE, pensé
// pour être découpable/partageable. Les dispatchers de connexion (login, /app)
// importent ACHETEUSE_EMAIL d'ici pour éviter d'ajouter un doublon de plus.

export const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'
export const VENDEUSE_EMAIL = 'nouvellerivecommandes@gmail.com'
export const ACHETEUSE_EMAIL = 'nouvelleriveachats@gmail.com'

/** Trigramme dédié de l'acheteuse (pièces achat maison, marge isolée). */
export const ACHETEUSE_TRIGRAMME = 'ACH'
/** Doc Firestore `chineuse` de l'acheteuse. */
export const ACHETEUSE_CHINEUSE_DOC = 'nouvelle-rive-achats'

export type Role = 'admin' | 'vendeuse' | 'acheteuse' | 'chineuse'

/** Rôle d'un email. `chineuse` est le rôle par défaut (catch-all). */
export function getRole(email: string | null | undefined): Role {
  if (email === ADMIN_EMAIL) return 'admin'
  if (email === VENDEUSE_EMAIL) return 'vendeuse'
  if (email === ACHETEUSE_EMAIL) return 'acheteuse'
  return 'chineuse'
}

export function isAcheteuse(email: string | null | undefined): boolean {
  return email === ACHETEUSE_EMAIL
}

/**
 * Trigrammes « stock maison » : pièces réellement achetées par Nouvelle Rive
 * (compte NR + acheteuse ACH). Ce sont les seuls à porter un prix d'achat et une
 * marge nette — les autres chineuses/déposantes sont sur rétrocession. Sert de
 * source unique pour l'affichage des champs prix d'achat / marge.
 */
export const HOUSE_PURCHASE_TRIGRAMMES = ['NR', ACHETEUSE_TRIGRAMME]

export function isHousePurchaseTrigramme(trigramme: string | null | undefined): boolean {
  return HOUSE_PURCHASE_TRIGRAMMES.includes((trigramme || '').toUpperCase().trim())
}

/** Page d'accueil après connexion, selon le rôle. */
export function landingForRole(email: string | null | undefined): string {
  switch (getRole(email)) {
    case 'admin': return '/admin/performance'
    case 'vendeuse': return '/vendeuse/restock'
    case 'acheteuse': return '/acheteuse/performance'
    default: return '/chineuse/performance'
  }
}
