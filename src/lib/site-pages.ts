// Source unique de vérité pour les pages du site.
//
// Trois consommateurs :
// - src/components/NavbarPublic.tsx → filtre `inNav: true`, trie par `navOrder`
// - src/lib/sitemap-data.ts         → filtre `inSitemap: true`, utilise `sitemap.*`
// - src/app/admin/site/page.tsx     → filtre `configurable: true` (dropdown pages)
//
// Avant : 3 listes hardcodées divergentes. Modifier une page (ex: renommer,
// masquer, changer de fréquence sitemap) demandait de retrouver 3 endroits.
// Maintenant : on modifie ici, les 3 consommateurs suivent.

export type SitePage = {
  /** Identifiant stable (doc siteConfig, key React). */
  id: string
  /** Chemin route Next.js. */
  path: string
  /** Suffixe hash optionnel pour le lien navbar (ex: '#titre'). */
  hash?: string
  /** Label pour le dropdown admin/site (FR). */
  labelAdmin?: string
  /** Labels navbar publique (FR / EN). */
  labels?: { fr: string; en: string }
  /** Apparaît dans le menu déroulant "Boutique" de la navbar publique. */
  inNav?: boolean
  /** Ordre d'apparition dans la navbar (ascendant). */
  navOrder?: number
  /** Configurable via /admin/site (a un doc siteConfig avec règles). */
  configurable?: boolean
  /** Apparaît dans /sitemap.xml. */
  inSitemap?: boolean
  /** Paramètres sitemap (si inSitemap). */
  sitemap?: {
    changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
    priority: number
  }
}

export const SITE_PAGES: SitePage[] = [
  // Home
  {
    id: 'home',
    path: '/',
    inSitemap: true,
    sitemap: { changeFrequency: 'daily', priority: 1.0 },
  },

  // Navigation publique (ordre = ordre d'affichage dans le menu Boutique)
  {
    id: 'coups-de-coeur',
    path: '/coups-de-coeur',
    hash: '#titre',
    labels: { fr: 'NOS PIÈCES PRÉFÉRÉES', en: 'OUR FAVORITE GEMS' },
    inNav: true,
    navOrder: 1,
    inSitemap: true,
    sitemap: { changeFrequency: 'weekly', priority: 0.8 },
  },
  {
    id: 'ete',
    path: '/ete',
    hash: '#titre',
    labelAdmin: 'Été',
    labels: { fr: 'ÉTÉ', en: 'SUMMER' },
    inNav: true,
    navOrder: 2,
    configurable: true,
    inSitemap: true,
    sitemap: { changeFrequency: 'weekly', priority: 0.8 },
  },
  {
    id: 'sac',
    path: '/sac',
    labels: { fr: 'SACS DE DESIGNER', en: 'DESIGNER BAGS' },
    inNav: true,
    navOrder: 3,
    inSitemap: true,
    sitemap: { changeFrequency: 'weekly', priority: 0.8 },
  },
  {
    id: 'luxe',
    path: '/luxe',
    hash: '#titre',
    labelAdmin: 'Le Luxe',
    labels: { fr: 'LE LUXE', en: 'LUXURY' },
    inNav: true,
    navOrder: 4,
    configurable: true,
    inSitemap: true,
    sitemap: { changeFrequency: 'daily', priority: 0.8 },
  },
  {
    id: 'iconiques-upcy',
    path: '/iconiques-upcy',
    labelAdmin: 'Iconiques Upcy',
    labels: { fr: 'NOS PIÈCES UPCY FAVORITES', en: 'FAVORITE UPCYCLED PIECES' },
    inNav: true,
    navOrder: 5,
    configurable: true,
    inSitemap: true,
    sitemap: { changeFrequency: 'weekly', priority: 0.8 },
  },
  {
    id: 'iconiques-vintage',
    path: '/les-iconiques',
    labelAdmin: 'Iconiques Vintage',
    labels: { fr: 'LES ICONIQUES DU VINTAGE', en: 'VINTAGE ICONICS' },
    inNav: true,
    navOrder: 6,
    configurable: true,
    inSitemap: true,
    sitemap: { changeFrequency: 'weekly', priority: 0.8 },
  },
  {
    id: 'soiree',
    path: '/soiree',
    hash: '#titre',
    labelAdmin: 'Soirée',
    labels: { fr: 'SOIRÉE', en: 'EVENING' },
    inNav: true,
    navOrder: 7,
    configurable: true,
    inSitemap: true,
    sitemap: { changeFrequency: 'weekly', priority: 0.8 },
  },
  {
    id: 'nos-creatrices',
    path: '/nos-creatrices',
    hash: '#titre',
    labels: { fr: 'NOS CRÉATRICES/CURATEURICES', en: 'OUR DESIGNERS / CURATORS' },
    inNav: true,
    navOrder: 8,
    inSitemap: true,
    sitemap: { changeFrequency: 'monthly', priority: 0.7 },
  },
  {
    id: 'nous-rencontrer',
    path: '/nous-rencontrer',
    hash: '#titre',
    labels: { fr: 'IRL : NOTRE BOUTIQUE 8 RUE DES ECOUFFES', en: 'IRL: OUR BOUTIQUE — 8 RUE DES ECOUFFES' },
    inNav: true,
    navOrder: 9,
    inSitemap: true,
    sitemap: { changeFrequency: 'monthly', priority: 0.7 },
  },
  {
    id: 'boutique',
    path: '/boutique',
    labels: { fr: 'TOUT VOIR', en: 'SEE ALL' },
    inNav: true,
    navOrder: 10,
  },

  // Configurables (admin/site) mais pas dans la navbar publique
  { id: 'new-in', path: '/new-in', labelAdmin: 'New In', configurable: true },
  { id: 'femme', path: '/femme', labelAdmin: '(Plutôt) Femme', configurable: true },
  { id: 'homme', path: '/homme', labelAdmin: '(Plutôt) Homme', configurable: true },
  { id: 'enfant', path: '/enfant', labelAdmin: 'Enfant', configurable: true },
  { id: 'accessoires', path: '/accessoires', labelAdmin: 'Accessoires', configurable: true },

  // Légal (sitemap uniquement)
  {
    id: 'legal-retours',
    path: '/legal/retours',
    inSitemap: true,
    sitemap: { changeFrequency: 'yearly', priority: 0.2 },
  },
  {
    id: 'legal-confidentialite',
    path: '/legal/confidentialite',
    inSitemap: true,
    sitemap: { changeFrequency: 'yearly', priority: 0.2 },
  },
  {
    id: 'legal-mentions-cgv',
    path: '/legal/mentions-cgv',
    inSitemap: true,
    sitemap: { changeFrequency: 'yearly', priority: 0.2 },
  },
]

/** Pages du menu Boutique publique, triées par navOrder. */
export function getNavPages(): SitePage[] {
  return SITE_PAGES
    .filter(p => p.inNav)
    .sort((a, b) => (a.navOrder ?? 999) - (b.navOrder ?? 999))
}

/** Pages configurables via /admin/site. Nav pages en premier, puis les autres. */
export function getConfigurablePages(): SitePage[] {
  return SITE_PAGES
    .filter(p => p.configurable)
    .sort((a, b) => {
      const aNav = a.inNav ? 0 : 1
      const bNav = b.inNav ? 0 : 1
      if (aNav !== bNav) return aNav - bNav
      return (a.navOrder ?? 999) - (b.navOrder ?? 999)
    })
}

/** Pages listées dans /sitemap.xml. */
export function getSitemapPages(): SitePage[] {
  return SITE_PAGES.filter(p => p.inSitemap && p.sitemap)
}
