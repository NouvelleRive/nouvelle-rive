// Activation des modules NR.
//
// Chaque module de l'app peut être activé ou désactivé indépendamment.
// L'idée : si on revend cette app à quelqu'un d'autre, on peut lui
// vendre des packages ("stock seul" / "stock + dépôt-vente" / "tout").
//
// Pour l'instant, valeurs en dur ici. Plus tard, à brancher sur
// Firestore (doc `tenants/<id>` ou `config/modules`) pour gérer
// plusieurs comptes clients.

export const MODULE_IDS = ['stock', 'depot-vente', 'achat'] as const
export type ModuleId = (typeof MODULE_IDS)[number]

const ACTIVATIONS: Record<ModuleId, boolean> = {
  stock: true,
  'depot-vente': true,
  achat: true,
}

export function isModuleEnabled(id: ModuleId): boolean {
  return ACTIVATIONS[id] === true
}
