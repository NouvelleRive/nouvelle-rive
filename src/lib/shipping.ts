// Tarifs et zones de livraison partagés client + serveur

export const SEUIL_LIVRAISON_OFFERTE = 150 // Gratuit > 150€ uniquement zone FR

export const FRAIS_LIVRAISON_FR = 15
export const FRAIS_LIVRAISON_EU = 20
export const FRAIS_LIVRAISON_INTL = 35

export type ZoneLivraison = 'FR' | 'EU' | 'INTL'

export const PAYS_LIVRAISON: { code: string; nom: string; zone: ZoneLivraison }[] = [
  { code: 'FR', nom: 'France', zone: 'FR' },
  { code: 'BE', nom: 'Belgique', zone: 'EU' },
  { code: 'DE', nom: 'Allemagne', zone: 'EU' },
  { code: 'ES', nom: 'Espagne', zone: 'EU' },
  { code: 'IT', nom: 'Italie', zone: 'EU' },
  { code: 'NL', nom: 'Pays-Bas', zone: 'EU' },
  { code: 'LU', nom: 'Luxembourg', zone: 'EU' },
  { code: 'PT', nom: 'Portugal', zone: 'EU' },
  { code: 'AT', nom: 'Autriche', zone: 'EU' },
  { code: 'IE', nom: 'Irlande', zone: 'EU' },
  { code: 'BG', nom: 'Bulgarie', zone: 'EU' },
  { code: 'CY', nom: 'Chypre', zone: 'EU' },
  { code: 'HR', nom: 'Croatie', zone: 'EU' },
  { code: 'DK', nom: 'Danemark', zone: 'EU' },
  { code: 'EE', nom: 'Estonie', zone: 'EU' },
  { code: 'FI', nom: 'Finlande', zone: 'EU' },
  { code: 'GR', nom: 'Grèce', zone: 'EU' },
  { code: 'HU', nom: 'Hongrie', zone: 'EU' },
  { code: 'LV', nom: 'Lettonie', zone: 'EU' },
  { code: 'LT', nom: 'Lituanie', zone: 'EU' },
  { code: 'MT', nom: 'Malte', zone: 'EU' },
  { code: 'PL', nom: 'Pologne', zone: 'EU' },
  { code: 'CZ', nom: 'République tchèque', zone: 'EU' },
  { code: 'RO', nom: 'Roumanie', zone: 'EU' },
  { code: 'SK', nom: 'Slovaquie', zone: 'EU' },
  { code: 'SI', nom: 'Slovénie', zone: 'EU' },
  { code: 'SE', nom: 'Suède', zone: 'EU' },
  { code: 'CH', nom: 'Suisse', zone: 'INTL' },
  { code: 'GB', nom: 'Royaume-Uni', zone: 'INTL' },
  { code: 'US', nom: 'États-Unis', zone: 'INTL' },
  { code: 'CA', nom: 'Canada', zone: 'INTL' },
  { code: 'AU', nom: 'Australie', zone: 'INTL' },
  { code: 'JP', nom: 'Japon', zone: 'INTL' },
]

export function getZonePays(code: string): ZoneLivraison {
  return PAYS_LIVRAISON.find(p => p.code === code)?.zone ?? 'INTL'
}

export function getFraisLivraison(codePays: string, sousTotal: number): number {
  const zone = getZonePays(codePays)
  if (zone === 'FR') {
    return sousTotal >= SEUIL_LIVRAISON_OFFERTE ? 0 : FRAIS_LIVRAISON_FR
  }
  if (zone === 'EU') return FRAIS_LIVRAISON_EU
  return FRAIS_LIVRAISON_INTL
}
