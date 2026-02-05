export const TEXTES_ECO_CIRCULAIRE = {
  1: {
    fr: `En choisissant une pièce de seconde main, vous participez activement à l'économie circulaire. Chaque vêtement qui trouve une nouvelle vie, c'est une production évitée, des ressources préservées et une empreinte carbone réduite. La mode vintage et seconde main représente une alternative responsable qui ne sacrifie ni le style ni la qualité.`,
    en: `By choosing a pre-owned piece, you are actively contributing to the circular economy. Every garment that finds a new life means one less produced, resources preserved, and a reduced carbon footprint. Vintage and pre-owned fashion is a responsible alternative that sacrifices neither style nor quality.`,
  },
  2: {
    fr: `En choisissant une pièce upcyclée, vous participez activement à l'économie circulaire. L'upcycling consiste à transformer des matières ou objets existants en créations nouvelles, sans passer par le recyclage industriel. C'est un processus créatif qui donne une seconde vie aux matériaux tout en réduisant les déchets et la consommation de ressources. Chaque pièce upcyclée est unique, fruit d'un savoir-faire artisanal qui valorise l'existant plutôt que de produire du neuf.`,
    en: `By choosing an upcycled piece, you are actively contributing to the circular economy. Upcycling involves transforming existing materials or objects into new creations, without going through industrial recycling. It is a creative process that gives materials a second life while reducing waste and resource consumption. Each upcycled piece is unique, the result of artisanal expertise that values what already exists rather than producing something new.`,
  },
  3: {
    fr: `En choisissant une pièce régénérée, vous participez activement à l'économie circulaire. La régénération consiste à récupérer des matières usagées pour les transformer en nouvelles matières premières de qualité. Ce procédé permet de créer à partir de ce qui existe déjà, réduisant ainsi la demande en ressources vierges et l'impact environnemental de la production. Chaque pièce régénérée incarne une mode qui repense son cycle de création.`,
    en: `By choosing a regenerated piece, you are actively contributing to the circular economy. Regeneration involves recovering used materials and transforming them into quality new raw materials. This process creates from what already exists, reducing the demand for virgin resources and the environmental impact of production. Each regenerated piece embodies fashion that rethinks its creation cycle.`,
  },
} as const

export type TexteEcoKey = keyof typeof TEXTES_ECO_CIRCULAIRE