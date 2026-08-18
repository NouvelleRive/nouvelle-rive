// src/lib/journal-articles.ts
// Contenu éditorial du Journal (blog) NOUVELLE RIVE.
// Source unique : chaque article est un objet ci-dessous, rendu par
//   - /journal              → l'index (liste des articles publiés)
//   - /journal/[slug]       → la page article (metadata + schema Article/BlogPosting)
//   - src/lib/sitemap-data  → ajoute chaque article publié au sitemap
//
// RÈGLE : ne mettre en ligne un article que lorsque `published: true`.
// Les brouillons (published:false) n'apparaissent ni sur le site ni dans le sitemap.
// Le texte est un brouillon FR à retoucher librement.

export type ArticleBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'quote'; text: string }

export type Article = {
  slug: string
  title: string
  /** Meta description (Google) + accroche sur la carte. ~150 caractères max. */
  description: string
  /** Étiquette courte affichée sur la carte (ex: GUIDE, VINTAGE, LE MARAIS). */
  category: string
  /** Date de publication au format ISO (YYYY-MM-DD). Sert au tri + schema. */
  date: string
  readingMinutes: number
  /** false = brouillon (invisible sur le site et le sitemap). */
  published: boolean
  blocks: ArticleBlock[]
  /** Appel à l'action interne en bas d'article (maillage SEO). */
  cta?: { href: string; label: string }
}

export const ARTICLES: Article[] = [
  {
    slug: 'depot-vente-luxe-paris',
    title: 'Dépôt-vente de luxe à Paris : comment ça marche',
    description:
      "Comment déposer et vendre ses pièces de luxe à Paris : le principe du dépôt-vente, les avantages et comment ça se passe chez Nouvelle Rive.",
    category: 'GUIDE',
    date: '2026-07-01',
    readingMinutes: 4,
    published: false,
    blocks: [
      { type: 'p', text: "Vous avez un sac, un manteau ou une paire de souliers de créateur qui dort dans votre dressing ? Le dépôt-vente est la façon la plus simple de lui offrir une seconde vie — et de le transformer en argent — sans vous en occuper vous-même. Voici comment ça fonctionne, et comment ça se passe chez Nouvelle Rive." },
      { type: 'h2', text: "Le principe du dépôt-vente" },
      { type: 'p', text: "Dans un dépôt-vente, vous confiez vos pièces à une boutique qui se charge de les mettre en valeur, de les présenter et de les vendre pour vous. Vous restez propriétaire de l'article jusqu'à sa vente : ce n'est qu'une fois la pièce vendue qu'une commission est prélevée par la boutique, le reste vous revient. C'est différent du rachat sec, où l'on vous achète la pièce immédiatement à un prix plus bas." },
      { type: 'h2', text: "Pourquoi passer par un dépôt-vente plutôt que vendre soi-même" },
      { type: 'ul', items: [
        "Vous ne gérez ni les photos, ni les annonces, ni les acheteurs, ni les arnaques.",
        "Votre pièce est mise en valeur dans un lieu physique et en ligne, devant une vraie clientèle.",
        "Les pièces de luxe bénéficient d'un regard d'expert sur l'authenticité et le juste prix.",
        "Vous donnez une seconde vie à vos vêtements plutôt que de les laisser dormir : c'est de la mode circulaire.",
      ] },
      { type: 'h2', text: "Comment ça se passe chez Nouvelle Rive" },
      { type: 'p', text: "Chez Nouvelle Rive, chaque portant est tenu par une créatrice ou curateurice qui compose son propre univers. Pour déposer vos pièces, il suffit de créer votre compte déposante sur le site via « Vendre chez Nouvelle Rive », puis de proposer vos articles. Nous sélectionnons des pièces en bon voire très bon état, avec une attention particulière à l'authenticité pour le vintage de luxe et les sacs de designer." },
      { type: 'p', text: "Une fois acceptée, votre pièce rejoint la boutique, au 8 rue des Écouffes, en plein Marais, et notre boutique en ligne — avec une livraison dans le monde entier. Vous suivez tout depuis votre espace." },
      { type: 'quote', text: "Le dépôt-vente, c'est offrir une seconde vie à une belle pièce sans effort — et faire de la place pour la suivante." },
    ],
    cta: { href: '/client/login', label: 'Vendre chez Nouvelle Rive →' },
  },
  {
    slug: 'reconnaitre-vrai-sac-luxe-vintage',
    title: 'Comment reconnaître un vrai sac de luxe vintage',
    description:
      "Cuir, coutures, quincaillerie, numéro de série, dustbag : les points à vérifier pour reconnaître un vrai sac de luxe vintage et éviter la contrefaçon.",
    category: 'GUIDE',
    date: '2026-07-10',
    readingMinutes: 5,
    published: false,
    blocks: [
      { type: 'p', text: "Acheter un sac de luxe en seconde main, c'est faire une superbe affaire — à condition de savoir reconnaître une pièce authentique. Voici les points que les experts vérifient, pour acheter l'esprit tranquille." },
      { type: 'h2', text: "1. Le cuir et la matière" },
      { type: 'p', text: "Un cuir de luxe a une odeur naturelle, une souplesse et un grain réguliers. Méfiez-vous des matières qui sentent le plastique, des grains trop parfaits ou trop synthétiques. Le vintage a le droit d'être patiné : une belle patine est souvent un gage d'authenticité, pas un défaut." },
      { type: 'h2', text: "2. Les coutures" },
      { type: 'p', text: "Sur une vraie pièce, les coutures sont régulières, droites, sans fil qui dépasse, et le nombre de points est constant. Des coutures irrégulières ou grossières sont un signal d'alerte. Regardez aussi la symétrie des motifs (un monogramme bien aligné aux coutures, par exemple)." },
      { type: 'h2', text: "3. La quincaillerie" },
      { type: 'p', text: "Fermoirs, zips, boucles et rivets d'une maison de luxe sont lourds, bien finis, et souvent gravés du nom de la marque. Un métal léger, une gravure floue ou une couleur qui s'écaille trahissent une contrefaçon." },
      { type: 'h2', text: "4. Le numéro de série, la date code et les tampons" },
      { type: 'p', text: "Beaucoup de maisons apposent un numéro de série, un « date code » ou un tampon à chaud discret. La typographie doit être nette et régulière. C'est un point technique qui varie selon les marques et les époques — en cas de doute, un œil expert fait la différence." },
      { type: 'h2', text: "5. Les accessoires d'origine" },
      { type: 'p', text: "Dustbag, boîte, cadenas, certificat éventuel : ils ne prouvent pas à eux seuls l'authenticité (ils se contrefont aussi), mais un ensemble cohérent et de bonne qualité est un bon signe supplémentaire." },
      { type: 'quote', text: "La meilleure garantie reste d'acheter auprès d'un professionnel qui contrôle chaque pièce avant la vente." },
      { type: 'p', text: "Chez Nouvelle Rive, chaque pièce de luxe est sélectionnée et vérifiée avant d'être mise en vente. La plupart sont accompagnées d'un certificat, parfois d'un certificat d'origine, et peuvent venir avec leur dustbag ou leur boîte d'origine." },
    ],
    cta: { href: '/luxe', label: 'Voir les pièces de luxe →' },
  },
  {
    slug: 'vintage-upcycle-regenere-difference',
    title: 'Vintage, upcyclé, régénéré : quelle différence ?',
    description:
      "Vintage, upcyclé, régénéré, seconde main : que veulent dire ces mots de la mode circulaire ? Un guide clair pour bien choisir ses pièces.",
    category: 'MODE CIRCULAIRE',
    date: '2026-07-20',
    readingMinutes: 4,
    published: false,
    blocks: [
      { type: 'p', text: "Vintage, upcyclé, régénéré, seconde main… Ces mots reviennent partout dans la mode responsable, souvent mélangés. Voici ce qu'ils veulent vraiment dire, pour savoir exactement ce que vous achetez." },
      { type: 'h2', text: "Vintage" },
      { type: 'p', text: "Une pièce est dite vintage lorsqu'elle a une vraie valeur d'époque — généralement plus de vingt ans — et qu'elle est représentative du style ou du savoir-faire de sa période. Le vintage n'est pas seulement « ancien » : c'est une pièce qui a traversé le temps et qui garde (ou gagne) de la valeur. Un tailleur des années 80 ou un sac emblématique d'une maison en sont de bons exemples." },
      { type: 'h2', text: "Seconde main" },
      { type: 'p', text: "La seconde main, c'est simplement tout vêtement déjà porté qui trouve un nouveau propriétaire, quel que soit son âge. Tout le vintage est de la seconde main, mais toute la seconde main n'est pas du vintage." },
      { type: 'h2', text: "Upcyclé" },
      { type: 'p', text: "L'upcycling (ou surcyclage) consiste à transformer une pièce ou une matière existante en une création nouvelle, souvent unique. Une chemise devient une robe, des chutes de tissu deviennent un sac : on « monte en gamme » la matière au lieu de la jeter. C'est de la création à part entière, avec une vraie valeur ajoutée." },
      { type: 'h2', text: "Régénéré" },
      { type: 'p', text: "Le régénéré désigne une pièce ou une matière remise en état, nettoyée, réparée ou retravaillée pour repartir comme neuve. L'idée est de prolonger la vie d'un vêtement plutôt que d'en produire un nouveau." },
      { type: 'quote', text: "Le point commun de ces quatre approches : garder les vêtements en circulation, et hors des poubelles." },
      { type: 'p', text: "Chez Nouvelle Rive, vous trouvez ces trois familles réunies — vintage, upcyclé et régénéré — toutes cruelty free et pensées pour n'endommager ni les animaux ni la planète. Chaque portant est tenu par une créatrice différente, avec son propre univers." },
    ],
    cta: { href: '/boutique', label: 'Découvrir la sélection →' },
  },
  {
    slug: 'chiner-vintage-marais',
    title: 'Où chiner du vintage dans le Marais',
    description:
      "Le Marais est le quartier du vintage à Paris. Nos conseils pour bien chiner rue des Écouffes et autour, et faire de vraies trouvailles.",
    category: 'LE MARAIS',
    date: '2026-07-30',
    readingMinutes: 4,
    published: false,
    blocks: [
      { type: 'p', text: "Si Paris a une capitale du vintage, c'est bien le Marais. Ruelles pavées, boutiques indépendantes, friperies pointues et pépites de créateurs : le quartier est un terrain de chasse idéal. Voici comment bien y chiner." },
      { type: 'h2', text: "Pourquoi le Marais ?" },
      { type: 'p', text: "Quartier des arts, de la mode et de la tolérance, le Marais concentre depuis des années une densité rare de boutiques indépendantes et de lieux de mode circulaire. On y passe facilement d'une adresse à l'autre à pied, ce qui en fait le parcours parfait pour une journée de chine." },
      { type: 'h2', text: "Nos conseils pour bien chiner" },
      { type: 'ul', items: [
        "Prenez votre temps : les meilleures trouvailles se méritent en fouillant portant par portant.",
        "Venez en début de semaine ou en tout début de journée : la sélection est fraîche et moins fouillée.",
        "Renseignez-vous sur les arrivages : certaines adresses renouvellent leurs pièces plusieurs fois par jour.",
        "Essayez : les coupes vintage taillent différemment d'aujourd'hui, fiez-vous à l'essayage plus qu'à l'étiquette.",
        "Regardez l'état et les finitions plutôt que la seule marque : une belle pièce sans logo vaut mieux qu'un logo fatigué.",
      ] },
      { type: 'h2', text: "Notre adresse : 8 rue des Écouffes" },
      { type: 'p', text: "Nouvelle Rive se niche rue des Écouffes, l'ancienne « rue aux vêtements », dans les murs de la première boîte lesbienne du Marais, le 3W. Chaque portant y est composé par une créatrice ou curateurice différente, avec sa propre gamme de prix — de la pièce à moins de 20 € au vintage de luxe. Nous recevons 2 à 3 arrivages par jour (sauf le week-end), donc la sélection change en permanence." },
      { type: 'quote', text: "Ouvert 11h–20h tous les jours, à deux pas du métro Saint-Paul." },
    ],
    cta: { href: '/nous-rencontrer', label: 'Venir nous voir →' },
  },
  {
    slug: 'vintage-luxe-petit-prix',
    title: 'Vintage de luxe à petit prix : bien acheter sans se ruiner',
    description:
      "Comment s'offrir du beau vintage sans se ruiner : nos conseils pour bien acheter à petit prix, et la cheap room à moins de 50 € chez Nouvelle Rive.",
    category: 'GUIDE',
    date: '2026-08-08',
    readingMinutes: 4,
    published: false,
    blocks: [
      { type: 'p', text: "Le vintage a une réputation d'exclusivité — mais bien chiner, c'est justement pouvoir s'habiller avec du beau sans exploser son budget. Voici comment faire de vraies affaires." },
      { type: 'h2', text: "Miser sur la qualité plutôt que le logo" },
      { type: 'p', text: "Une pièce des années 80 ou 90 est souvent mieux construite qu'un vêtement neuf d'entrée de gamme : matières nobles, coutures solides, finitions soignées. Cherchez la qualité de fabrication (doublure, boutons, tissu) plutôt que le seul nom de la marque, et vous trouverez des pièces superbes pour quelques dizaines d'euros." },
      { type: 'h2', text: "Viser les catégories sous-cotées" },
      { type: 'ul', items: [
        "Les basiques vintage (chemises, mailles, jeans) : intemporels et abordables.",
        "Les accessoires : ceintures, foulards, bijoux fantaisie changent une tenue pour pas grand-chose.",
        "Les pièces sans logo mais bien coupées, souvent boudées à tort.",
      ] },
      { type: 'h2', text: "Profiter des arrivages fréquents" },
      { type: 'p', text: "Plus une boutique renouvelle ses pièces, plus vous avez de chances de tomber sur la bonne affaire au bon moment. Revenez régulièrement, en boutique comme en ligne." },
      { type: 'h2', text: "La cheap room : tout à moins de 50 €" },
      { type: 'p', text: "Chez Nouvelle Rive, nous croyons que le beau doit être accessible à toutes les bourses. C'est pourquoi nous développons une offre abordable, la « cheap room », où tout est à moins de 50 €. À côté, chaque portant garde son propre univers et sa propre gamme — de la petite trouvaille à la pièce d'exception à plus de 10 000 €." },
      { type: 'quote', text: "Bien acheter, ce n'est pas dépenser moins : c'est dépenser mieux, pour des pièces qui durent." },
    ],
    cta: { href: '/boutique', label: 'Trouver ma pépite →' },
  },
  {
    slug: 'vintage-plutot-que-fast-fashion',
    title: 'Pourquoi choisir le vintage plutôt que la fast fashion',
    description:
      "Impact écologique, qualité, style unique : pourquoi le vintage et l'upcycling battent la fast fashion. Le point de vue de Nouvelle Rive.",
    category: 'ENGAGEMENT',
    date: '2026-08-15',
    readingMinutes: 4,
    published: false,
    blocks: [
      { type: 'p', text: "« No more fast fashion. » C'est notre point de départ chez Nouvelle Rive. Choisir le vintage, ce n'est pas seulement une question de style : c'est un geste concret pour la planète, et souvent un meilleur achat. Voici pourquoi." },
      { type: 'h2', text: "L'impact de la fast fashion" },
      { type: 'p', text: "La mode est l'une des industries les plus polluantes au monde : production massive, matières synthétiques dérivées du pétrole, eau consommée à outrance, vêtements portés quelques fois puis jetés. Chaque nouvelle pièce produite a un coût environnemental — que l'achat d'occasion évite presque entièrement." },
      { type: 'h2', text: "Le vintage, un cercle vertueux" },
      { type: 'ul', items: [
        "Zéro nouvelle production : on prolonge la vie de vêtements qui existent déjà.",
        "Moins de déchets : une pièce chinée est une pièce sauvée de la benne.",
        "Une qualité souvent supérieure : les pièces d'époque sont faites pour durer.",
        "Un style unique : vous ne croiserez pas la même tenue à chaque coin de rue.",
      ] },
      { type: 'h2', text: "Cruelty free et sans impact sur la planète" },
      { type: 'p', text: "Chez Nouvelle Rive, toutes les pièces — vintage, upcyclées ou régénérées — sont cruelty free et pensées pour n'endommager ni les animaux ni la planète. Nous mettons en avant le travail de créatrices et curateurices engagées, sur le long terme, dans un lieu permanent au cœur du Marais." },
      { type: 'quote', text: "La seule règle dans la mode est la responsabilité. Le futur sera vintage." },
    ],
    cta: { href: '/manifesto', label: 'Lire notre manifesto →' },
  },
]

/** Articles publiés, triés du plus récent au plus ancien. */
export function getPublishedArticles(): Article[] {
  return ARTICLES.filter(a => a.published).sort((a, b) => b.date.localeCompare(a.date))
}

/** Renvoie l'article même s'il est en brouillon (pour la prévisualisation par URL directe).
 *  La page /journal/[slug] met les brouillons en `noindex` et les exclut du sitemap. */
export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find(a => a.slug === slug)
}
