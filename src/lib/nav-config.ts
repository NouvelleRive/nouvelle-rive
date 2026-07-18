// Config nav dynamique stockée dans Firestore `siteConfig/_nav`.
// Le NavManager admin l'édite. NavbarPublic la lira quand on branchera (TODO).
// Pour l'instant, source de vérité publique = SITE_PAGES statique.

import { SITE_PAGES } from './site-pages'

export type NavPage = {
  id: string
  path: string
  hash?: string
  labelFr: string
  labelEn: string
  navOrder: number
  hidden: boolean
  isBuiltin: boolean
  configurable: boolean
  hasIconiquesManager?: boolean
}

export type NavConfig = {
  pages: NavPage[]
}

export const NAV_DOC_ID = '_nav'

/** État initial dérivé de SITE_PAGES pour le premier chargement admin. */
export function seedNavFromStatic(): NavPage[] {
  return SITE_PAGES
    .filter(p => p.inNav || p.configurable)
    .map((p, idx) => ({
      id: p.id,
      path: p.path,
      hash: p.hash,
      labelFr: p.labels?.fr || p.labelAdmin || p.id,
      labelEn: p.labels?.en || p.labelAdmin || p.id,
      navOrder: p.navOrder ?? 1000 + idx,
      hidden: !p.inNav,
      isBuiltin: true,
      configurable: !!p.configurable,
      hasIconiquesManager: p.id === 'iconiques-vintage' || p.id === 'iconiques-upcy',
    }))
    .sort((a, b) => a.navOrder - b.navOrder)
}
