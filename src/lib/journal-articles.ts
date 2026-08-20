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
  | { type: 'img'; src: string; alt: string }
  | { type: 'video'; src: string; alt: string }
  | { type: 'videorow'; videos: { src: string; alt: string }[] }
  | { type: 'slider'; images: { src: string; alt: string }[] }
  | { type: 'map'; query: string }

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
  /** Sources citées, affichées en bas d'article (communes FR/EN). */
  sources?: { label: string; url: string }[]
  /** Appel à l'action interne en bas d'article (maillage SEO). */
  cta?: { href: string; label: string }
  /** Version anglaise (SEO US/UK). Vide = pas encore traduit → page /en en noindex. */
  titleEn?: string
  descriptionEn?: string
  categoryEn?: string
  bodyEn?: string
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
  let gallery: { src: string; alt: string }[] = []
  let vids: { src: string; alt: string }[] = []

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
  // Images consécutives (sans ligne vide entre elles) → 1 image seule, ou un slider si ≥ 2.
  const flushGallery = () => {
    if (gallery.length === 1) blocks.push({ type: 'img', ...gallery[0] })
    else if (gallery.length > 1) blocks.push({ type: 'slider', images: gallery.slice() })
    gallery = []
  }
  // Vidéos consécutives → 1 vidéo seule, ou une rangée (2 ou 3 par ligne) si ≥ 2.
  const flushVideos = () => {
    if (vids.length === 1) blocks.push({ type: 'video', ...vids[0] })
    else if (vids.length > 1) blocks.push({ type: 'videorow', videos: vids.slice() })
    vids = []
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flushGallery()
      flushVideos()
      flushList()
      flushPara()
      continue
    }
    if (line.startsWith('::map ')) {
      flushGallery()
      flushVideos()
      flushList()
      flushPara()
      blocks.push({ type: 'map', query: line.slice(6).trim() })
      continue
    }
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imgMatch) {
      const src = imgMatch[2].trim()
      const alt = imgMatch[1].trim()
      if (/\.mp4(\?|$)/i.test(src)) {
        flushGallery()
        flushList()
        flushPara()
        vids.push({ src, alt })
      } else {
        flushVideos()
        flushList()
        flushPara()
        gallery.push({ src, alt })
      }
      continue
    }
    if (line.startsWith('## ')) {
      flushGallery()
      flushVideos()
      flushList()
      flushPara()
      blocks.push({ type: 'h2', text: line.slice(3).trim() })
    } else if (line.startsWith('> ')) {
      flushGallery()
      flushVideos()
      flushList()
      flushPara()
      blocks.push({ type: 'quote', text: line.slice(2).trim() })
    } else if (line.startsWith('- ')) {
      flushGallery()
      flushVideos()
      flushPara()
      list.push(line.slice(2).trim())
    } else {
      flushGallery()
      flushVideos()
      flushList()
      para.push(line)
    }
  }
  flushGallery()
  flushVideos()
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
      "Dépôt-vente de luxe à Paris : principe, commission, authentification, délais et paiement. Comment déposer et vendre vos pièces chez Nouvelle Rive.",
    category: 'GUIDE',
    date: '2026-08-19',
    readingMinutes: 7,
    body: `Un sac, un manteau ou une paire de souliers de créateur dort dans votre dressing ? Le dépôt-vente est la façon la plus simple de lui offrir une seconde vie — et de le transformer en argent — sans vous en occuper vous-même. On vous explique le principe, la commission, les délais, et comment ça se passe concrètement chez Nouvelle Rive, au cœur du Marais.

## Le dépôt-vente, c'est quoi exactement ?

Dans un dépôt-vente, vous confiez vos pièces à une boutique qui se charge de les mettre en valeur, de les présenter et de les vendre pour vous. Point essentiel : vous restez propriétaire de l'article jusqu'à sa vente. Ce n'est qu'une fois la pièce vendue qu'une commission est prélevée ; le reste vous revient.

C'est ce qui distingue le dépôt-vente de deux autres options :

- Le rachat cash : on vous achète la pièce immédiatement, mais à un prix nettement plus bas, car le revendeur prend tout le risque et toute la marge.
- La vente entre particuliers (Vinted, Vestiaire Collective) : vous encaissez davantage sur le papier, mais vous gérez tout — photos, annonce, questions, négociations, expédition, litiges et risques d'arnaque.

Le dépôt-vente est l'entre-deux malin : un meilleur prix que le rachat cash, sans la charge mentale de la vente en solo.

## Ce que vous pouvez déposer

Les dépôts-ventes de luxe acceptent en général les sacs et la maroquinerie, le prêt-à-porter, les souliers, les accessoires et parfois les bijoux. Les maisons les plus recherchées (Hermès, Chanel, Louis Vuitton, Dior, Gucci, Céline…) partent évidemment plus vite, mais une belle pièce vintage sans logo, bien coupée et en bon état, trouve aussi son public.

Chez Nouvelle Rive, on ne se limite pas au sac de marque : vintage de luxe, pièces de créateur, upcyclé, régénéré. Chaque portant est composé par une créatrice ou curateurice différente, avec son propre univers.

## Les conditions pour être accepté

Trois critères comptent partout :

- L'authenticité : indispensable, surtout sur le luxe. Une pièce dont l'authenticité ne peut pas être établie ne sera pas mise en vente.
- L'état : on retient des pièces en bon voire très bon état. Une exception peut être faite sur un vrai coup de cœur — le prix est alors ajusté en conséquence.
- La désirabilité : modèle, coupe, matière, saisonnalité. Une pièce recherchée se vend plus vite et plus cher.

## Le déroulé, pas à pas, chez Nouvelle Rive

1. Vous créez votre compte déposante sur le site, via « Vendre chez Nouvelle Rive », puis vous proposez vos pièces (photos + description).
2. On étudie votre proposition et on valide les pièces qui correspondent à la sélection.
3. Une fois acceptée, votre pièce est authentifiée, mise en valeur et photographiée par notre équipe.
4. Elle rejoint la boutique physique, au 8 rue des Écouffes, et notre boutique en ligne — avec livraison dans le monde entier.
5. Vous suivez tout depuis votre espace.

Ce qui change tout : vous ne gérez ni les acheteurs, ni les questions, ni les négociations, ni les livraisons, ni les arnaques. Votre bien est mis en avant par une équipe qualifiée, dans un lieu premium, devant une vraie clientèle.

## Authentification et mise en valeur

Sur le luxe et les sacs de designer, le contrôle d'authenticité est rigoureux (cuir, coutures, quincaillerie, numéros et tampons, cohérence de l'ensemble). La plupart des pièces de luxe sont accompagnées d'un certificat, parfois d'un certificat d'origine, et peuvent venir avec leur dustbag ou leur boîte d'origine.

Une pièce bien présentée — nettoyée, photographiée avec soin, exposée dans un cadre premium — se vend mieux qu'une annonce faite à la va-vite depuis un canapé. C'est une grande partie de la valeur ajoutée du dépôt-vente.

## Commission, prix et paiement

Sur le marché du luxe, la commission d'un dépôt-vente se situe le plus souvent entre 30 et 50 %, parfois dégressive sur les pièces les plus chères. Le prix de vente est fixé pour être juste : assez attractif pour partir, assez haut pour vous rémunérer correctement. Vous êtes payé après la vente.

Concrètement : plus une pièce est désirable et bien présentée, plus elle se vend vite — et une pièce qui se vend vite, c'est de l'argent qui rentre sans effort de votre côté.

## Combien de temps pour vendre — et les invendus ?

Tout dépend de la pièce : une maison très recherchée dans une taille courante peut partir en quelques jours, une pièce plus pointue prend davantage de temps. Beaucoup de dépôts-ventes appliquent des baisses de prix programmées pour dynamiser les pièces qui tardent. Renseignez-vous toujours sur la politique concernant les invendus (retour, délai, don).

> Le dépôt-vente, c'est offrir une seconde vie à une belle pièce sans effort — et faire de la place pour la suivante.

## Pourquoi passer par Nouvelle Rive

Nouvelle Rive est un lieu permanent au cœur du Marais, pensé pour mettre en avant le travail de créatrices et curateurices engagées sur le long terme. Vos pièces y sont vues en boutique comme en ligne, dans un esprit responsable et anti fast-fashion. Prêt à faire de la place — et à donner une seconde vie à vos plus belles pièces ?`,
    cta: { href: '/client/login', label: 'Vendre chez Nouvelle Rive →' },
  },
  {
    slug: 'reconnaitre-vrai-sac-luxe-vintage',
    title: 'Comment reconnaître un vrai sac de luxe vintage',
    description:
      "Cuir, coutures, quincaillerie, numéro de série, dustbag : le guide complet pour authentifier un sac de luxe vintage et éviter la contrefaçon.",
    category: 'GUIDE',
    date: '2026-08-20',
    readingMinutes: 7,
    body: `Acheter un sac de luxe en seconde main, c'est faire une superbe affaire — à condition de savoir reconnaître une pièce authentique. Les contrefaçons de 2026 sont de plus en plus soignées, mais quelques réflexes d'expert suffisent à démasquer la plupart des faux. Voici les points à vérifier, du prix au numéro de série, avec la spécificité des pièces vintage.

## 1. Le prix, le vendeur et le canal de vente

Premier signal, avant même de toucher le sac : une remise irréaliste sur un modèle iconique doit alerter. Le luxe se déprécie peu en seconde main. Regardez qui vend et par quel canal : un professionnel qui contrôle ses pièces, avec une adresse et une réputation, vaut mille fois une annonce anonyme avec des photos trop parfaites.

## 2. Le cuir et la matière

Un cuir de luxe a une odeur naturelle, une souplesse et un grain réguliers. Méfiez-vous des matières qui sentent le plastique, des grains trop parfaits ou trop synthétiques. Sur le vintage, une belle patine (une vachette qui passe du beige au miel puis au brun) est souvent un gage d'authenticité, pas un défaut.

## 3. Les coutures et les finitions

Sur une vraie pièce, les coutures sont régulières, droites, sans fil qui dépasse, avec un nombre de points constant. Des coutures irrégulières, grossières ou des bords « collés » plutôt que cousus sont un signal d'alerte. Regardez la teinture des tranches (les bords de cuir) : nette et uniforme sur un vrai, bâclée sur un faux.

## 4. Les logos, le monogramme et la typographie

Le monogramme doit être symétrique, centré et aligné aux coutures — sur les grandes maisons, un motif n'est jamais coupé n'importe comment. La typographie du logo (forme des lettres, espacement) est un marqueur fort : les faux se trahissent souvent sur un détail de lettre ou un alignement approximatif.

## 5. La quincaillerie

Fermoirs, zips, boucles et rivets d'une maison de luxe sont lourds, bien finis, à la dorure uniforme, et souvent gravés du nom de la marque de façon nette. Un métal léger, une gravure floue, une couleur qui s'écaille trahissent une contrefaçon. Les zips portent fréquemment une signature (Éclair, Lampo, YKK selon les maisons et les époques).

## 6. L'intérieur : doublure, étiquettes et heat stamp

Ouvrez le sac. La doublure, les étiquettes cousues et le tampon à chaud (heat stamp) doivent être nets et cohérents avec l'époque du modèle. Une typographie bavée, une étiquette mal cousue ou un matériau de doublure cheap sont autant de drapeaux rouges.

## 7. Le numéro de série, le date code et la puce

Beaucoup de maisons ont longtemps utilisé un numéro de série ou un « date code » discret. Attention : les faux en ont aussi — un numéro seul ne prouve rien, c'est sa cohérence (emplacement, police, format d'époque) qui compte. Point technique récent : depuis 2021, certaines maisons (comme Louis Vuitton) ont remplacé le date code par une puce RFID intégrée. Une pièce vintage, elle, n'aura ni puce ni carte moderne — d'où l'importance de critères adaptés à son âge.

## 8. Facture, dustbag et carte d'authenticité

Dustbag, boîte, cadenas, carte : ils renforcent un dossier mais ne prouvent rien à eux seuls, car ils se contrefont aussi. Et une facture ne garantit pas l'authenticité — elle se falsifie facilement. Un ensemble cohérent et de bonne qualité est un bon signe supplémentaire, pas une preuve absolue.

## Le cas particulier du vintage

Sur une pièce ancienne, ne cherchez pas une carte d'authenticité moderne ou une puce : concentrez-vous sur le cuir, les coutures, la quincaillerie d'époque et la cohérence générale. C'est justement là que l'œil expert et la connaissance des modèles font la différence.

## Faut-il faire authentifier son sac ?

Une authentification professionnelle (souvent entre 50 et 170 €) peut rassurer sur une pièce chère achetée entre particuliers. Mais le plus simple reste d'acheter auprès d'un professionnel qui contrôle chaque pièce avant la mise en vente — vous économisez le stress et le coût de l'expertise.

> La meilleure garantie ? Acheter dans un lieu qui engage sa réputation sur chaque pièce.

## Acheter l'esprit tranquille chez Nouvelle Rive

Chez Nouvelle Rive, chaque pièce de luxe est sélectionnée et vérifiée avant d'être mise en vente. La plupart sont accompagnées d'un certificat, parfois d'un certificat d'origine, et peuvent venir avec leur dustbag ou leur boîte d'origine. Vous achetez en toute confiance, en boutique au 8 rue des Écouffes ou en ligne.`,
    cta: { href: '/luxe', label: 'Voir les pièces de luxe →' },
  },
  {
    slug: 'vintage-upcycle-regenere-difference',
    title: 'Vintage, upcyclé, régénéré : quelle différence ?',
    description:
      "Vintage, seconde main, friperie, upcyclé, régénéré : toutes les définitions de la mode circulaire, la règle des 20 ans et comment bien choisir.",
    category: 'MODE CIRCULAIRE',
    date: '2026-08-21',
    readingMinutes: 6,
    body: `Vintage, seconde main, friperie, upcyclé, régénéré, rétro… Ces mots reviennent partout dans la mode responsable, souvent mélangés. Voici ce qu'ils veulent vraiment dire, pour savoir exactement ce que vous achetez — et acheter mieux.

## Vintage : la règle des 20 ans

Une pièce est dite vintage lorsqu'elle a une vraie valeur d'époque — généralement plus de vingt ans — et qu'elle est représentative du style ou du savoir-faire de sa période. En dessous de 20 ans, on parle plutôt de rétro ou simplement de seconde main ; au-delà de 100 ans, on entre dans l'antiquité. Le vintage n'est donc pas seulement « ancien » : c'est une pièce qui a traversé le temps et qui garde, voire gagne, de la valeur. Un tailleur des années 80, une pièce Y2K du début des années 2000 ou un sac emblématique d'une maison en sont de bons exemples.

## Seconde main : la grande famille

La seconde main, c'est tout vêtement déjà porté qui trouve un nouveau propriétaire, quel que soit son âge. C'est la catégorie la plus large. Retenez la règle d'inclusion : tout le vintage est de la seconde main, mais toute la seconde main n'est pas du vintage. Un jean acheté l'an dernier et revendu aujourd'hui est de la seconde main — pas du vintage.

## Vintage vs friperie : ce n'est pas pareil

On confond souvent les deux. Une friperie, au sens strict, c'est un lieu qui écoule de gros volumes de vêtements d'occasion en vrac, souvent récents et de toutes marques (y compris de la fast fashion), parfois vendus au kilo. Le vintage, lui, désigne une sélection de pièces datées et choisies pour leur qualité ou leur intérêt. On peut chiner du vintage dans une friperie, mais une friperie n'est pas synonyme de vintage.

## Vintage vs rétro : l'âge contre le style

Le rétro, c'est du neuf qui imite l'esthétique du passé (une robe fabriquée aujourd'hui « façon années 50 »). C'est une question de style, pas d'âge. Le vintage, lui, a réellement l'âge qu'il affiche. Une pièce peut être néo-rétro sans avoir un seul jour d'histoire.

## Upcyclé : transformer plutôt que jeter

L'upcycling (ou surcyclage) consiste à transformer une pièce ou une matière existante en une création nouvelle, souvent unique. Une chemise devient une robe, des chutes de tissu deviennent un sac. On « monte en gamme » la matière au lieu de la jeter. Deux formes coexistent : l'upcycling artisanal (pièces uniques, faites main) et l'upcycling à partir de deadstock (chutes ou stocks d'usine invendus). Dans les deux cas, c'est de la création à part entière, avec une vraie valeur ajoutée.

## Upcyclé vs recyclé : la nuance clé

C'est LA confusion à éviter. L'upcycling préserve le vêtement ou le tissu et le transforme tel quel. Le recyclage, lui, détruit la matière (broyage, effilochage, refilage) pour en refaire une nouvelle fibre. L'upcycling garde l'histoire de la pièce ; le recyclage repart de zéro. Et à l'échelle mondiale, seul un très faible pourcentage des textiles est réellement recyclé en nouveaux vêtements — d'où l'intérêt de prolonger l'existant.

## Régénéré : la pièce remise à neuf

Le régénéré désigne une pièce ou une matière remise en état : nettoyée, réparée, retravaillée pour repartir comme neuve. Côté fibres, on parle aussi de matières régénérées (issues de déchets pré ou post-consommation, remises en boucle). L'idée reste la même : prolonger la vie d'un vêtement plutôt que d'en produire un nouveau. C'est un terme encore rare dans le grand public — et pourtant central dans la mode circulaire.

## Le point commun de tous ces mots

> Garder les vêtements en circulation, et hors des poubelles.

Vintage, seconde main, upcyclé, régénéré : ce sont quatre façons de faire durer la matière plutôt que d'alimenter la surproduction.

## Chez Nouvelle Rive : les trois réunis

Chez Nouvelle Rive, vous trouvez ces familles réunies — vintage, upcyclé et régénéré — toutes cruelty free et pensées pour n'endommager ni les animaux ni la planète. Chaque portant est tenu par une créatrice différente, avec son propre univers et sa propre gamme de prix, de la pièce à moins de 20 € au vintage de luxe. À vous de chiner celle qui vous ressemble.`,
    cta: { href: '/boutique', label: 'Découvrir la sélection →' },
  },
  {
    slug: 'chiner-vintage-marais',
    title: 'Où chiner du vintage dans le Marais',
    description:
      "Le Marais, épicentre du vintage à Paris : nos conseils pour bien chiner rue des Écouffes et alentours, meilleurs jours, budgets et bons réflexes.",
    category: 'LE MARAIS',
    date: '2026-08-22',
    readingMinutes: 6,
    body: `Si Paris a une capitale du vintage, c'est bien le Marais. Entre les 3e et 4e arrondissements, ses ruelles pavées concentrent friperies au kilo, dépôts-ventes de luxe, vintage de créateur et pépites indépendantes. Voici comment bien y chiner, quartier par quartier, avec les bons réflexes.

## Pourquoi le Marais est l'épicentre du vintage parisien

Quartier des arts, de la mode et de la tolérance, le Marais réunit depuis des années une densité rare de boutiques indépendantes et de lieux de mode circulaire. Tout se fait à pied, d'une adresse à l'autre, ce qui en fait le parcours parfait pour une journée de chine — sans jamais reprendre le métro.

## Se repérer : les rues et les stations

Le cœur battant du vintage se déploie autour de quelques axes : la rue des Rosiers et la rue des Écouffes, la rue du Roi de Sicile, la rue de la Verrerie, la rue du Temple, et plus au nord, du côté du Haut-Marais, la rue de Turenne, la rue Charlot et la rue de Bretagne. Côté transports, retenez les stations Saint-Paul (ligne 1), Hôtel de Ville, Rambuteau, Chemin Vert et Filles du Calvaire : elles quadrillent tout le quartier.

## Chiner selon son budget et son style

Le Marais a l'avantage de couvrir toutes les envies et toutes les bourses :

- Petit budget : friperies au kilo et fripe à petit prix, parfaites pour dénicher un basique ou une pièce à retravailler.
- Vintage de créateur et sélection pointue : des boutiques qui trient et datent leurs pièces, pour chiner sans fouiller.
- Dépôt-vente et vintage de luxe : sacs, archives et pièces d'exception des grandes maisons, contrôlées et présentées avec soin.

Côté style, on passe du rétro 70s-90s au Y2K, du streetwear aux archives de créateurs — souvent dans la même rue.

## Nos conseils pour bien chiner

- Prenez votre temps : les meilleures trouvailles se méritent en fouillant portant par portant.
- Venez en début de semaine ou en tout début de journée : la sélection est fraîche et moins fouillée.
- Renseignez-vous sur les arrivages : certaines adresses renouvellent leurs pièces plusieurs fois par jour.
- Essayez systématiquement : les coupes vintage taillent différemment d'aujourd'hui, fiez-vous à l'essayage plus qu'à l'étiquette.
- Regardez l'état et les finitions plutôt que la seule marque : une belle pièce sans logo vaut mieux qu'un logo fatigué.
- Sur le luxe, vérifiez l'authenticité (cuir, coutures, quincaillerie) ou achetez dans un lieu qui la garantit.

## Quel est le meilleur moment pour venir ?

En règle générale, le début de semaine et les matinées offrent les rayons les mieux remplis et les moins chahutés. Les adresses qui reçoivent des arrivages fréquents renouvellent en continu : y repasser régulièrement, c'est multiplier ses chances de tomber sur la bonne pièce au bon moment.

## Friperie, dépôt-vente ou vintage : quelle différence ?

Dans le Marais, les trois cohabitent, et mieux vaut savoir ce que vous cherchez. La friperie écoule de gros volumes d'occasion, parfois au kilo, tous styles et toutes époques confondus : idéale pour fouiller et dénicher à petit prix. Le dépôt-vente met en avant des pièces confiées par des particuliers, souvent contrôlées, avec un vrai soin de présentation — c'est là qu'on trouve le luxe de seconde main authentifié. Le vintage, enfin, désigne une sélection de pièces datées et choisies pour leur qualité. Une même adresse peut mélanger les trois : posez la question, on vous orientera.

## Grandes tailles, homme, enfant : on trouve pour qui ?

Le vintage a longtemps eu la réputation de manquer de choix au-delà de certaines tailles. C'est de moins en moins vrai : les boutiques du Marais élargissent leurs sélections, et l'essayage reste roi puisque les coupes d'époque taillent différemment. Vestiaire masculin, pièces mixtes, accessoires : il y a de quoi faire pour tout le monde, à condition de prendre le temps de chiner.

## Notre adresse : 8 rue des Écouffes

Nouvelle Rive se niche rue des Écouffes, l'ancienne « rue aux vêtements », dans les murs de la première boîte lesbienne du Marais, le 3W. Chaque portant y est composé par une créatrice ou curateurice différente, avec sa propre gamme de prix — de la pièce à moins de 20 € au vintage de luxe, en passant par la « cheap room » où tout est à moins de 50 €. Nous recevons 2 à 3 arrivages par jour (sauf le week-end), donc la sélection change en permanence.

> Ouvert 11h–20h tous les jours, à deux pas du métro Saint-Paul (ligne 1).

Bref, si vous voulez chiner du vintage dans le Marais, commencez par pousser notre porte — puis laissez le quartier faire le reste.`,
    cta: { href: '/nous-rencontrer', label: 'Venir nous voir →' },
  },
  {
    slug: 'vintage-luxe-petit-prix',
    title: 'Vintage de luxe à petit prix : bien acheter sans se ruiner',
    description:
      "Bien acheter du vintage à petit prix : reconnaître la qualité, viser les bonnes catégories, éviter les arnaques, et la cheap room à moins de 50 €.",
    category: 'GUIDE',
    date: '2026-08-23',
    readingMinutes: 6,
    body: `Le vintage a une réputation d'exclusivité — mais bien chiner, c'est justement pouvoir s'habiller avec du beau sans exploser son budget. Voici comment repérer les vraies affaires, éviter les pièges, et où trouver du vintage abordable à Paris.

## Vintage ou seconde main : ce que vous achetez vraiment

Rappel utile : une pièce vintage a en général plus de vingt ans et une vraie valeur d'époque, quand la seconde main désigne tout vêtement déjà porté. Cette distinction compte pour le prix : une pièce vintage rare peut prendre de la valeur, là où une pièce de seconde main récente se négocie surtout à la baisse.

## Miser sur la qualité plutôt que sur le logo

Une pièce des années 80 ou 90 est souvent mieux construite qu'un vêtement neuf d'entrée de gamme : matières nobles, coutures solides, finitions soignées. Cherchez la qualité de fabrication (doublure, boutons, tissu, mentions « Made in France » ou « Made in Italy ») plutôt que le seul nom de la marque, et vous trouverez des pièces superbes pour quelques dizaines d'euros.

## Viser les catégories sous-cotées

C'est le secret des bons chineurs : sur une même maison, les pièces les moins convoitées coûtent une fraction du sac vedette.

- Les basiques vintage (chemises, mailles, jeans) : intemporels et abordables.
- Les accessoires : ceintures, foulards, bijoux fantaisie, petite maroquinerie (un portefeuille de marque plutôt que le sac).
- Les pièces sans logo mais bien coupées, souvent boudées à tort.

## Vérifier l'authenticité et l'état avant de payer

Un prix bas n'est pas forcément suspect — mais restez vigilant. Sur le luxe, contrôlez les coutures, les logos, la quincaillerie, les zips (YKK, Lampo selon les maisons) et la cohérence générale. Un doute ? Un revendeur professionnel qui garantit ses pièces vous évite l'expertise. Côté état, inspectez les défauts cachés (doublure, aisselles, semelles) et essayez toujours : les tailles d'époque taillent souvent plus petit qu'aujourd'hui.

## Attention aux arnaques en ligne

Sur les plateformes entre particuliers, méfiez-vous des photos trop parfaites ou visiblement retouchées, des prix irréalistes et des vendeurs sans historique. Demandez des photos supplémentaires (étiquettes, coutures, numéros) avant tout achat. C'est là que l'achat en lieu physique ou auprès d'un professionnel reprend tout son sens : ce que vous voyez est ce que vous achetez.

## Profiter des arrivages fréquents

Plus une boutique renouvelle ses pièces, plus vous avez de chances de tomber sur la bonne affaire au bon moment. La régularité paie : revenez souvent, en boutique comme en ligne, plutôt que d'attendre « le bon jour ».

## Quelles décennies et quelles marques privilégier ?

Pour bien acheter à petit prix, visez les décennies riches en pièces solides et stylées : les années 70 pour les imprimés et les coupes fluides, les années 80-90 pour les tailleurs, la maille et le denim, le début des années 2000 (Y2K) pour les pièces qui reviennent en force aujourd'hui. Côté marques, ne vous focalisez pas uniquement sur les grands logos : beaucoup de maisons de confection françaises et italiennes offraient une qualité remarquable pour des prix aujourd'hui dérisoires en seconde main. Un « Made in France » ou « Made in Italy » sur l'étiquette est souvent un meilleur indice que le nom lui-même.

## Entretenir et faire durer sa pièce

Une bonne affaire le reste si la pièce dure. Aérez et brossez plutôt que de laver trop souvent, confiez les matières délicates (soie, cuir, cachemire) à un pressing ou à un cordonnier de confiance, et rangez à l'abri de la lumière. Un petit accroc ou un bouton manquant ne doit jamais vous faire renoncer à une belle pièce : une retouche coûte quelques euros et prolonge sa vie de plusieurs années. Prendre soin de ses vêtements, c'est la première règle de la mode responsable.

## La cheap room : tout à moins de 50 €

Chez Nouvelle Rive, nous croyons que le beau doit être accessible à toutes les bourses. C'est pourquoi nous développons une offre abordable, la « cheap room », où tout est à moins de 50 €. À côté, chaque portant garde son propre univers et sa propre gamme — de la petite trouvaille à la pièce d'exception à plus de 10 000 €. Et chaque pièce de luxe est authentifiée avant la vente : vous faites une affaire sans prendre de risque.

> Bien acheter, ce n'est pas dépenser moins : c'est dépenser mieux, pour des pièces qui durent.

Prête à chiner votre prochaine pépite sans vous ruiner ? La sélection change tous les jours.`,
    cta: { href: '/boutique', label: 'Trouver ma pépite →' },
  },
  {
    slug: 'vintage-plutot-que-fast-fashion',
    title: 'Pourquoi choisir le vintage plutôt que la fast fashion',
    description:
      "Impact écologique chiffré, qualité, style unique : pourquoi le vintage et l'upcycling battent la fast fashion. Le point de vue de Nouvelle Rive.",
    category: 'ENGAGEMENT',
    date: '2026-08-24',
    readingMinutes: 6,
    body: `« No more fast fashion. » C'est notre point de départ chez Nouvelle Rive. Choisir le vintage, ce n'est pas seulement une question de style : c'est un geste concret pour la planète, et souvent un meilleur achat. Voici pourquoi — chiffres à l'appui.

## L'impact réel de la fast fashion

La mode est l'une des industries les plus polluantes au monde. Quelques repères souvent cités par l'ADEME, Oxfam ou la Fondation Ellen MacArthur :

- Le textile représenterait entre 2 et 8 % des émissions mondiales de gaz à effet de serre.
- Environ 20 % de la pollution mondiale de l'eau proviendrait de la teinture et de la finition des vêtements.
- Un seul jean peut nécessiter jusqu'à 7 500 litres d'eau ; un t-shirt en coton, environ 2 700 litres.
- L'équivalent d'un camion-benne de textiles est enfoui ou incinéré chaque seconde dans le monde.
- Chaque Français jette en moyenne une douzaine de kilos de textiles par an.

Derrière ces chiffres, une même logique : produire toujours plus, toujours plus vite, pour des vêtements portés quelques fois puis jetés.

## Le vintage, un cercle vertueux

Acheter d'occasion casse ce cycle. En choisissant le vintage ou l'upcyclé, vous :

- évitez une nouvelle production : on prolonge la vie de vêtements qui existent déjà ;
- réduisez les déchets : une pièce chinée est une pièce sauvée de la benne ;
- misez sur la qualité : les pièces d'époque sont souvent faites pour durer ;
- affirmez un style unique : vous ne croiserez pas la même tenue à chaque coin de rue.

Un repère parlant : doubler la durée de vie d'un vêtement réduit d'environ moitié son impact climatique. Faire durer, c'est déjà agir.

## L'argument qualité (et prix)

La fast fashion mise sur des matières bon marché et des finitions minimales. Le vintage, lui, donne accès à des matières nobles et à un savoir-faire d'époque — parfois à des pièces de grandes maisons — pour le prix d'un vêtement neuf lambda. Pensez en coût par port : une belle pièce portée cent fois revient bien moins cher qu'un achat impulsif porté deux fois.

## L'impact social, souvent oublié

Derrière les prix cassés de la fast fashion se cachent des conditions de production précaires. Acheter en seconde main, c'est sortir de cette chaîne : on ne finance pas une nouvelle production à bas coût, on fait circuler l'existant.

## Reconnaître une pièce vintage de qualité

Choisir le vintage, c'est aussi apprendre à repérer ce qui va durer. Quelques réflexes simples : privilégiez les matières naturelles (laine, coton, soie, cuir) aux synthétiques bas de gamme ; vérifiez la solidité des coutures et des doublures ; regardez les finitions (boutons, fermetures, ourlets) ; et fiez-vous au toucher, souvent plus parlant qu'une étiquette. Une pièce bien construite d'il y a trente ans tiendra encore trente ans — c'est tout l'inverse d'un vêtement fast fashion pensé pour une saison.

## Le plaisir de la pièce unique

On l'oublie souvent : au-delà de l'écologie, chiner est un plaisir. C'est la chasse au trésor, la pièce que personne d'autre n'a, l'histoire derrière un vêtement qui a déjà vécu. Là où la fast fashion propose la même chose à tout le monde en dix exemplaires par ville, le vintage offre du singulier. S'habiller devient un choix, pas un réflexe.

## La nuance honnête : consommer moins, mieux

Soyons lucides : la seconde main n'est pas un permis de surconsommer. Accumuler des dizaines de pièces d'occasion « parce que ce n'est pas cher » recrée le problème sous une autre forme. Le vrai geste, c'est d'acheter moins mais mieux — des pièces choisies, durables, que l'on garde.

## Cruelty free et sans impact sur la planète

> La seule règle dans la mode est la responsabilité. Le futur sera vintage.

Chez Nouvelle Rive, toutes les pièces — vintage, upcyclées ou régénérées — sont cruelty free et pensées pour n'endommager ni les animaux ni la planète. Nous mettons en avant le travail de créatrices et curateurices engagées, sur le long terme, dans un lieu permanent au cœur du Marais. Chiner ici, c'est s'habiller avec du sens — et du style.`,
    sources: [
      { label: 'ADEME — La mode sans dessus dessous', url: 'https://www.ademe.fr' },
      { label: 'Oxfam France — Impact de la fast fashion', url: 'https://www.oxfamfrance.org' },
      { label: 'Ellen MacArthur Foundation — A new textiles economy', url: 'https://www.ellenmacarthurfoundation.org' },
    ],
    cta: { href: '/manifesto', label: 'Lire notre manifesto →' },
  },
  {
    slug: 'pourquoi-detester-fast-fashion',
    title: 'Pourquoi on déteste la fast fashion',
    description:
      "C'est moche, c'est du plastique, c'est mauvais pour ta santé et pour la planète. Pourquoi la fast fashion est un désastre — et ce qu'on lui préfère.",
    category: 'MANIFESTE',
    date: '2026-08-25',
    readingMinutes: 5,
    body: `On ne va pas y aller par quatre chemins : chez Nouvelle Rive, on déteste la fast fashion. Pas par snobisme, pas par posture — parce qu'à peu près tout, dans ce modèle, va contre ce en quoi on croit. Voici pourquoi, sans langue de bois.

## C'est moche

Commençons par le plus simple. La fast fashion, c'est la même chose partout, pour tout le monde, en dix exemplaires par ville. Des coupes sans âme, copiées à la va-vite sur les défilés, produites en série et démodées avant même d'être portées. Le vintage, lui, a du caractère : une pièce a une histoire, une singularité, une allure. Tu ne croiseras pas ton double dans la rue.

## C'est du plastique

La plupart des vêtements fast fashion sont en polyester, acrylique, nylon — autrement dit du pétrole transformé en tissu. Tu portes littéralement du plastique. Et à chaque lavage, ces matières relâchent des micro-fibres plastiques qui finissent dans l'eau, puis dans la chaîne alimentaire. Une pièce vintage en matière naturelle — laine, coton, soie, cuir — c'est tout l'inverse.

## C'est mauvais pour ta santé

Ce plastique ne vient pas seul. Teintures, traitements, colles, substances chimiques : les vêtements ultra-bon-marché sont bourrés de résidus qui touchent ta peau toute la journée, dont certains suspectés d'être des perturbateurs endocriniens. S'habiller ne devrait pas être un risque. Une pièce qui a déjà vécu et été lavée des dizaines de fois a évacué l'essentiel de ces substances.

## Ça épuise la planète

Produire du neuf en continu, ça coûte cher à la Terre : des milliers de litres d'eau pour un seul jean, des matières premières extraites sans fin, une énergie colossale — le tout pour des vêtements portés quelques fois. La fast fashion, c'est du gaspillage érigé en modèle économique. Le vintage ne prélève rien de neuf : il fait circuler ce qui existe déjà.

## Ça transforme la planète en poubelle géante

L'autre bout de la chaîne est encore plus violent. Des montagnes de vêtements invendus ou jetés finissent enfouies, brûlées ou entassées dans des décharges à ciel ouvert, à l'autre bout du monde. On produit tellement, si vite, que la planète devient la benne de nos placards. Chaque pièce chinée, c'est une pièce en moins dans cette montagne.

## C'est produit dans des conditions indignes

Ces prix cassés ont un coût humain. Derrière l'étiquette à quelques euros, il y a des ateliers où l'on travaille beaucoup, pour très peu, dans des conditions souvent dangereuses — et, dans certaines chaînes d'approvisionnement, du travail d'enfants documenté par les ONG. Acheter d'occasion, c'est refuser de financer cette machine.

## Ça enrichit une poignée de gens

Pendant que la planète trinque et que les ouvrières s'épuisent, le modèle concentre des fortunes colossales entre très peu de mains — des fortunes qui, parfois, financent tout sauf le progrès social ou écologique. La fast fashion n'habille pas le monde par générosité : elle le fait pour engraisser un système. Choisir le vintage, c'est sortir de ce circuit-là.

## Elle vole le travail des jeunes créatrices

Il y a aussi ce qu'on dénonce trop peu : la fast fashion copie. Des géants comme Shein sont accusés, à de multiples reprises et jusque devant les tribunaux, de reprendre les créations d'artistes et de créatrices indépendantes — imprimés, bijoux, coupes, illustrations — pour les produire en masse en quelques jours, sans crédit ni rémunération. D'un côté le talent et des mois de travail ; de l'autre, le pillage industrialisé. Chez Nouvelle Rive, on fait exactement l'inverse : on met les jeunes créatrices en lumière et on protège leur travail, au lieu de le laisser se faire voler.

> On ne déteste pas la mode. On déteste ce qu'on en a fait.

## Ce qu'on préfère, mille fois

À tout ça, on oppose une autre idée de la mode : des pièces uniques, vintage, upcyclées ou régénérées, toutes cruelty free, choisies par des créatrices et curateurices engagées. De la qualité qui dure, du style qui te ressemble, et une conscience tranquille. C'est ça, Nouvelle Rive — un lieu permanent au cœur du Marais où s'habiller redevient un plaisir, pas une nuisance.

Le futur sera vintage. Et il sera bien plus beau.`,
    sources: [
      { label: 'ADEME — La mode sans dessus dessous', url: 'https://www.ademe.fr' },
      { label: 'Oxfam France — Impact de la fast fashion', url: 'https://www.oxfamfrance.org' },
      { label: 'Ellen MacArthur Foundation — A new textiles economy', url: 'https://www.ellenmacarthurfoundation.org' },
    ],
    cta: { href: '/boutique', label: 'Passer au vintage →' },
  },
]

/** Graine complète avec état éditorial initial (non relu, non publié). */
export function seedStoredArticles(): StoredArticle[] {
  return SEED_ARTICLES.map(a => ({ ...a, relu: false, published: false }))
}
