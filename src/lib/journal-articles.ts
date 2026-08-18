// src/lib/journal-articles.ts
// Modèle + SEED du Journal (blog) NOUVELLE RIVE.
//
// Source de vérité en prod = Firestore (doc siteConfig/_journal), éditable depuis
// /admin/site/journal. Ce fichier ne sert plus que de :
//   1. modèle de types (Article, StoredArticle)
//   2. graine (SEED) utilisée pour initialiser Firestore au premier chargement
//   3. utilitaires de rendu du corps (parseBody) partagés client + serveur
//
// Le corps de l'article s'écrit en texte simple (markdown allégé) :
//   ## Titre de section      → sous-titre (h2)
//   > citation               → citation mise en avant
//   - élément                → puce de liste
//   (ligne normale)          → paragraphe
//   (ligne vide)             → séparation

export type ArticleBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'quote'; text: string }

export type Article = {
  slug: string
  title: string
  /** Meta description (Google) + accroche sur la carte. ~150 caractères. */
  description: string
  /** Étiquette courte (ex: GUIDE, LE MARAIS). */
  category: string
  /** Date de publication programmée (YYYY-MM-DD) : l'article ne sort qu'à cette date. */
  date: string
  readingMinutes: number
  /** Image de couverture (URL ou chemin /public). Optionnelle. */
  cover?: string
  /** Corps de l'article en markdown allégé (voir en-tête). */
  body: string
  /** Appel à l'action interne en bas d'article (maillage SEO). */
  cta?: { href: string; label: string }
}

/** Article + état éditorial (tel que stocké dans Firestore). */
export type StoredArticle = Article & {
  /** Relu par l'équipe. Un article ne peut être publié que s'il est relu. */
  relu: boolean
  /** Armé pour publication. Combiné à la date, décide de la mise en ligne. */
  published: boolean
}

/** Découpe le corps markdown-allégé en blocs rendus. */
export function parseBody(body: string): ArticleBlock[] {
  const lines = (body || '').replace(/\r\n/g, '\n').split('\n')
  const blocks: ArticleBlock[] = []
  let para: string[] = []
  let list: string[] = []

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: 'p', text: para.join(' ').trim() })
      para = []
    }
  }
  const flushList = () => {
    if (list.length) {
      blocks.push({ type: 'ul', items: list.slice() })
      list = []
    }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flushList()
      flushPara()
      continue
    }
    if (line.startsWith('## ')) {
      flushList()
      flushPara()
      blocks.push({ type: 'h2', text: line.slice(3).trim() })
    } else if (line.startsWith('> ')) {
      flushList()
      flushPara()
      blocks.push({ type: 'quote', text: line.slice(2).trim() })
    } else if (line.startsWith('- ')) {
      flushPara()
      list.push(line.slice(2).trim())
    } else {
      flushList()
      para.push(line)
    }
  }
  flushList()
  flushPara()
  return blocks
}

// Dates par défaut : un article par jour à partir du 19/08/2026 (modifiable dans l'admin).
export const SEED_ARTICLES: Article[] = [
  {
    slug: 'depot-vente-luxe-paris',
    title: 'Dépôt-vente de luxe à Paris : comment ça marche',
    description:
      "Comment déposer et vendre ses pièces de luxe à Paris : le principe du dépôt-vente, les avantages et comment ça se passe chez Nouvelle Rive.",
    category: 'GUIDE',
    date: '2026-08-19',
    readingMinutes: 4,
    body: `Vous avez un sac, un manteau ou une paire de souliers de créateur qui dort dans votre dressing ? Le dépôt-vente est la façon la plus simple de lui offrir une seconde vie — et de le transformer en argent — sans vous en occuper vous-même. Voici comment ça fonctionne, et comment ça se passe chez Nouvelle Rive.

## Le principe du dépôt-vente

Dans un dépôt-vente, vous confiez vos pièces à une boutique qui se charge de les mettre en valeur, de les présenter et de les vendre pour vous. Vous restez propriétaire de l'article jusqu'à sa vente : ce n'est qu'une fois la pièce vendue qu'une commission est prélevée par la boutique, le reste vous revient. C'est différent du rachat sec, où l'on vous achète la pièce immédiatement à un prix plus bas.

## Pourquoi passer par un dépôt-vente plutôt que vendre soi-même

- Vous ne gérez ni les acheteurs, ni les questions, ni les négociations, ni les livraisons, ni les arnaques.
- Votre bien est mis en avant par une équipe qualifiée, dans un lieu premium et en ligne, devant une vraie clientèle.
- Les pièces de luxe bénéficient d'un regard d'expert sur l'authenticité et le juste prix.
- Vous donnez une seconde vie à vos vêtements plutôt que de les laisser dormir : c'est de la mode circulaire.

## Comment ça se passe chez Nouvelle Rive

Chez Nouvelle Rive, chaque portant est tenu par une créatrice ou curateurice qui compose son propre univers. Pour déposer vos pièces, il suffit de créer votre compte déposante sur le site via « Vendre chez Nouvelle Rive », puis de proposer vos articles. Nous sélectionnons des pièces en bon voire très bon état, avec une attention particulière à l'authenticité pour le vintage de luxe et les sacs de designer.

Une fois acceptée, votre pièce rejoint la boutique, au 8 rue des Écouffes, en plein Marais, et notre boutique en ligne — avec une livraison dans le monde entier. Vous suivez tout depuis votre espace.

> Le dépôt-vente, c'est offrir une seconde vie à une belle pièce sans effort — et faire de la place pour la suivante.`,
    cta: { href: '/client/login', label: 'Vendre chez Nouvelle Rive →' },
  },
  {
    slug: 'reconnaitre-vrai-sac-luxe-vintage',
    title: 'Comment reconnaître un vrai sac de luxe vintage',
    description:
      "Cuir, coutures, quincaillerie, numéro de série, dustbag : les points à vérifier pour reconnaître un vrai sac de luxe vintage et éviter la contrefaçon.",
    category: 'GUIDE',
    date: '2026-08-20',
    readingMinutes: 5,
    body: `Acheter un sac de luxe en seconde main, c'est faire une superbe affaire — à condition de savoir reconnaître une pièce authentique. Voici les points que les experts vérifient, pour acheter l'esprit tranquille.

## 1. Le cuir et la matière

Un cuir de luxe a une odeur naturelle, une souplesse et un grain réguliers. Méfiez-vous des matières qui sentent le plastique, des grains trop parfaits ou trop synthétiques. Le vintage a le droit d'être patiné : une belle patine est souvent un gage d'authenticité, pas un défaut.

## 2. Les coutures

Sur une vraie pièce, les coutures sont régulières, droites, sans fil qui dépasse, et le nombre de points est constant. Des coutures irrégulières ou grossières sont un signal d'alerte. Regardez aussi la symétrie des motifs (un monogramme bien aligné aux coutures, par exemple).

## 3. La quincaillerie

Fermoirs, zips, boucles et rivets d'une maison de luxe sont lourds, bien finis, et souvent gravés du nom de la marque. Un métal léger, une gravure floue ou une couleur qui s'écaille trahissent une contrefaçon.

## 4. Le numéro de série, la date code et les tampons

Beaucoup de maisons apposent un numéro de série, un « date code » ou un tampon à chaud discret. La typographie doit être nette et régulière. C'est un point technique qui varie selon les marques et les époques — en cas de doute, un œil expert fait la différence.

## 5. Les accessoires d'origine

Dustbag, boîte, cadenas, certificat éventuel : ils ne prouvent pas à eux seuls l'authenticité (ils se contrefont aussi), mais un ensemble cohérent et de bonne qualité est un bon signe supplémentaire.

> La meilleure garantie reste d'acheter auprès d'un professionnel qui contrôle chaque pièce avant la vente.

Chez Nouvelle Rive, chaque pièce de luxe est sélectionnée et vérifiée avant d'être mise en vente. La plupart sont accompagnées d'un certificat, parfois d'un certificat d'origine, et peuvent venir avec leur dustbag ou leur boîte d'origine.`,
    cta: { href: '/luxe', label: 'Voir les pièces de luxe →' },
  },
  {
    slug: 'vintage-upcycle-regenere-difference',
    title: 'Vintage, upcyclé, régénéré : quelle différence ?',
    description:
      "Vintage, upcyclé, régénéré, seconde main : que veulent dire ces mots de la mode circulaire ? Un guide clair pour bien choisir ses pièces.",
    category: 'MODE CIRCULAIRE',
    date: '2026-08-21',
    readingMinutes: 4,
    body: `Vintage, upcyclé, régénéré, seconde main… Ces mots reviennent partout dans la mode responsable, souvent mélangés. Voici ce qu'ils veulent vraiment dire, pour savoir exactement ce que vous achetez.

## Vintage

Une pièce est dite vintage lorsqu'elle a une vraie valeur d'époque — généralement plus de vingt ans — et qu'elle est représentative du style ou du savoir-faire de sa période. Le vintage n'est pas seulement « ancien » : c'est une pièce qui a traversé le temps et qui garde (ou gagne) de la valeur. Un tailleur des années 80 ou un sac emblématique d'une maison en sont de bons exemples.

## Seconde main

La seconde main, c'est simplement tout vêtement déjà porté qui trouve un nouveau propriétaire, quel que soit son âge. Tout le vintage est de la seconde main, mais toute la seconde main n'est pas du vintage.

## Upcyclé

L'upcycling (ou surcyclage) consiste à transformer une pièce ou une matière existante en une création nouvelle, souvent unique. Une chemise devient une robe, des chutes de tissu deviennent un sac : on « monte en gamme » la matière au lieu de la jeter. C'est de la création à part entière, avec une vraie valeur ajoutée.

## Régénéré

Le régénéré désigne une pièce ou une matière remise en état, nettoyée, réparée ou retravaillée pour repartir comme neuve. L'idée est de prolonger la vie d'un vêtement plutôt que d'en produire un nouveau.

> Le point commun de ces quatre approches : garder les vêtements en circulation, et hors des poubelles.

Chez Nouvelle Rive, vous trouvez ces trois familles réunies — vintage, upcyclé et régénéré — toutes cruelty free et pensées pour n'endommager ni les animaux ni la planète. Chaque portant est tenu par une créatrice différente, avec son propre univers.`,
    cta: { href: '/boutique', label: 'Découvrir la sélection →' },
  },
  {
    slug: 'chiner-vintage-marais',
    title: 'Où chiner du vintage dans le Marais',
    description:
      "Le Marais est le quartier du vintage à Paris. Nos conseils pour bien chiner rue des Écouffes et autour, et faire de vraies trouvailles.",
    category: 'LE MARAIS',
    date: '2026-08-22',
    readingMinutes: 4,
    body: `Si Paris a une capitale du vintage, c'est bien le Marais. Ruelles pavées, boutiques indépendantes, friperies pointues et pépites de créateurs : le quartier est un terrain de chasse idéal. Voici comment bien y chiner.

## Pourquoi le Marais ?

Quartier des arts, de la mode et de la tolérance, le Marais concentre depuis des années une densité rare de boutiques indépendantes et de lieux de mode circulaire. On y passe facilement d'une adresse à l'autre à pied, ce qui en fait le parcours parfait pour une journée de chine.

## Nos conseils pour bien chiner

- Prenez votre temps : les meilleures trouvailles se méritent en fouillant portant par portant.
- Venez en début de semaine ou en tout début de journée : la sélection est fraîche et moins fouillée.
- Renseignez-vous sur les arrivages : certaines adresses renouvellent leurs pièces plusieurs fois par jour.
- Essayez : les coupes vintage taillent différemment d'aujourd'hui, fiez-vous à l'essayage plus qu'à l'étiquette.
- Regardez l'état et les finitions plutôt que la seule marque : une belle pièce sans logo vaut mieux qu'un logo fatigué.

## Notre adresse : 8 rue des Écouffes

Nouvelle Rive se niche rue des Écouffes, l'ancienne « rue aux vêtements », dans les murs de la première boîte lesbienne du Marais, le 3W. Chaque portant y est composé par une créatrice ou curateurice différente, avec sa propre gamme de prix — de la pièce à moins de 20 € au vintage de luxe. Nous recevons 2 à 3 arrivages par jour (sauf le week-end), donc la sélection change en permanence.

> Ouvert 11h–20h tous les jours, à deux pas du métro Saint-Paul.`,
    cta: { href: '/nous-rencontrer', label: 'Venir nous voir →' },
  },
  {
    slug: 'vintage-luxe-petit-prix',
    title: 'Vintage de luxe à petit prix : bien acheter sans se ruiner',
    description:
      "Comment s'offrir du beau vintage sans se ruiner : nos conseils pour bien acheter à petit prix, et la cheap room à moins de 50 € chez Nouvelle Rive.",
    category: 'GUIDE',
    date: '2026-08-23',
    readingMinutes: 4,
    body: `Le vintage a une réputation d'exclusivité — mais bien chiner, c'est justement pouvoir s'habiller avec du beau sans exploser son budget. Voici comment faire de vraies affaires.

## Miser sur la qualité plutôt que le logo

Une pièce des années 80 ou 90 est souvent mieux construite qu'un vêtement neuf d'entrée de gamme : matières nobles, coutures solides, finitions soignées. Cherchez la qualité de fabrication (doublure, boutons, tissu) plutôt que le seul nom de la marque, et vous trouverez des pièces superbes pour quelques dizaines d'euros.

## Viser les catégories sous-cotées

- Les basiques vintage (chemises, mailles, jeans) : intemporels et abordables.
- Les accessoires : ceintures, foulards, bijoux fantaisie changent une tenue pour pas grand-chose.
- Les pièces sans logo mais bien coupées, souvent boudées à tort.

## Profiter des arrivages fréquents

Plus une boutique renouvelle ses pièces, plus vous avez de chances de tomber sur la bonne affaire au bon moment. Revenez régulièrement, en boutique comme en ligne.

## La cheap room : tout à moins de 50 €

Chez Nouvelle Rive, nous croyons que le beau doit être accessible à toutes les bourses. C'est pourquoi nous développons une offre abordable, la « cheap room », où tout est à moins de 50 €. À côté, chaque portant garde son propre univers et sa propre gamme — de la petite trouvaille à la pièce d'exception à plus de 10 000 €.

> Bien acheter, ce n'est pas dépenser moins : c'est dépenser mieux, pour des pièces qui durent.`,
    cta: { href: '/boutique', label: 'Trouver ma pépite →' },
  },
  {
    slug: 'vintage-plutot-que-fast-fashion',
    title: 'Pourquoi choisir le vintage plutôt que la fast fashion',
    description:
      "Impact écologique, qualité, style unique : pourquoi le vintage et l'upcycling battent la fast fashion. Le point de vue de Nouvelle Rive.",
    category: 'ENGAGEMENT',
    date: '2026-08-24',
    readingMinutes: 4,
    body: `« No more fast fashion. » C'est notre point de départ chez Nouvelle Rive. Choisir le vintage, ce n'est pas seulement une question de style : c'est un geste concret pour la planète, et souvent un meilleur achat. Voici pourquoi.

## L'impact de la fast fashion

La mode est l'une des industries les plus polluantes au monde : production massive, matières synthétiques dérivées du pétrole, eau consommée à outrance, vêtements portés quelques fois puis jetés. Chaque nouvelle pièce produite a un coût environnemental — que l'achat d'occasion évite presque entièrement.

## Le vintage, un cercle vertueux

- Zéro nouvelle production : on prolonge la vie de vêtements qui existent déjà.
- Moins de déchets : une pièce chinée est une pièce sauvée de la benne.
- Une qualité souvent supérieure : les pièces d'époque sont faites pour durer.
- Un style unique : vous ne croiserez pas la même tenue à chaque coin de rue.

## Cruelty free et sans impact sur la planète

Chez Nouvelle Rive, toutes les pièces — vintage, upcyclées ou régénérées — sont cruelty free et pensées pour n'endommager ni les animaux ni la planète. Nous mettons en avant le travail de créatrices et curateurices engagées, sur le long terme, dans un lieu permanent au cœur du Marais.

> La seule règle dans la mode est la responsabilité. Le futur sera vintage.`,
    cta: { href: '/manifesto', label: 'Lire notre manifesto →' },
  },
]

/** Graine complète avec état éditorial initial (non relu, non publié). */
export function seedStoredArticles(): StoredArticle[] {
  return SEED_ARTICLES.map(a => ({ ...a, relu: false, published: false }))
}
