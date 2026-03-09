export function isMaro(categorie: string): boolean {
  return categorie?.toLowerCase().includes('sac')
}

// Places occupées = produits reçus en boutique
// + produits en attente dont la déposante a un RDV futur
export function countPlacesOccupees(
  produits: any[],
  restockSlots: Record<string, { nom: string; type: string; trigramme?: string }>,
  today: string
): { pap: number; maro: number } {
  // Trigrammes avec un RDV futur
  const trigrammesAvecRdv = new Set(
    Object.entries(restockSlots)
      .filter(([key, slot]) => {
        const dateStr = key.split('_')[0]
        return slot.type === 'deposante' && slot.trigramme && dateStr >= today
      })
      .map(([_, slot]) => slot.trigramme!)
  )

  const actifs = produits.filter(p => {
    if (!p.trigramme) return false
    if (p.vendu) return false
    if (p.statutRecuperation === 'recupere') return false
    // Reçu en boutique → occupe une place
    if (p.recu === true) return true
    // En attente → occupe une place seulement si RDV futur pris
    if (trigrammesAvecRdv.has(p.trigramme)) return true
    return false
  })

  const maro = actifs.filter(p => isMaro(p.categorie || '')).length
  const pap = actifs.length - maro
  return { pap, maro }
}

export function getPlacesDisponibles(
  produits: any[],
  config: { maxPap: number; maxMaro: number },
  restockSlots: Record<string, any> = {},
  today: string = new Date().toISOString().split('T')[0]
): { pap: number; maro: number; total: number } {
  const { pap, maro } = countPlacesOccupees(produits, restockSlots, today)
  return {
    pap: Math.max(0, config.maxPap - pap),
    maro: Math.max(0, config.maxMaro - maro),
    total: Math.max(0, (config.maxPap - pap) + (config.maxMaro - maro))
  }
}

export const MAX_ARTICLES_PAR_DEPOT = 5
