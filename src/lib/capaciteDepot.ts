// Retourne true si la catégorie est MARO (sac)
export function isMaro(categorie: string): boolean {
  return categorie?.toLowerCase().includes('sac')
}

// Compte les places occupées par les déposantes
// Un produit occupe une place si : il appartient à une déposante 
// ET n'est pas vendu ET pas récupéré (statutRecuperation !== 'recupere')
export function countPlacesOccupees(produits: any[]): { pap: number, maro: number } {
  const actifs = produits.filter(p => 
    p.trigramme && // déposante = a un trigramme
    !p.vendu &&
    p.statutRecuperation !== 'recupere'
  )
  const maro = actifs.filter(p => isMaro(p.categorie || '')).length
  const pap = actifs.length - maro
  return { pap, maro }
}

// Retourne les places disponibles
export function getPlacesDisponibles(
  produits: any[],
  config: { maxPap: number, maxMaro: number }
): { pap: number, maro: number, total: number } {
  const { pap, maro } = countPlacesOccupees(produits)
  return {
    pap: Math.max(0, config.maxPap - pap),
    maro: Math.max(0, config.maxMaro - maro),
    total: Math.max(0, (config.maxPap - pap) + (config.maxMaro - maro))
  }
}

// Déposante peut prendre RDV si au moins 1 place disponible
export function peutPrendreRdv(
  produits: any[],
  config: { maxPap: number, maxMaro: number }
): boolean {
  const { total } = getPlacesDisponibles(produits, config)
  return total > 0
}

// Max 5 articles par dépôt
export const MAX_ARTICLES_PAR_DEPOT = 5