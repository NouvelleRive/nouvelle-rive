export type PrixCategorie = {
  categorie: string
  prixMin: number
  prixMax: number
}

export type MarqueDeposante = {
  nom: string
  categories: string
  prix?: PrixCategorie[]
}

export const MARQUES_DEPOSANTE: MarqueDeposante[] = [
  { nom: 'AGNÈS B.', categories: 'Prêt-à-porter, maroquinerie' },
  {
    nom: 'ALAÏA',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures, bijoux, souliers',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 200, prixMax: 1500 },
      { categorie: 'Robe', prixMin: 150, prixMax: 1200 },
      { categorie: 'Jupe / Short', prixMin: 100, prixMax: 600 },
      { categorie: 'Haut / Chemise', prixMin: 80, prixMax: 400 },
      { categorie: 'Sac', prixMin: 300, prixMax: 2000 },
      { categorie: 'Souliers', prixMin: 150, prixMax: 800 },
    ],
  },
  {
    nom: 'ALEXANDER MCQUEEN',
    categories: 'Prêt-à-porter, petite maroquinerie, ceintures, souliers',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 150, prixMax: 1200 },
      { categorie: 'Robe', prixMin: 120, prixMax: 1000 },
      { categorie: 'Souliers', prixMin: 100, prixMax: 600 },
    ],
  },
  {
    nom: 'ANN DEMEULEMEESTER',
    categories: 'Prêt-à-porter',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 100, prixMax: 800 },
      { categorie: 'Robe', prixMin: 80, prixMax: 600 },
      { categorie: 'Pantalon', prixMin: 80, prixMax: 400 },
    ],
  },
  {
    nom: 'BALENCIAGA',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 200, prixMax: 1500 },
      { categorie: 'Robe', prixMin: 150, prixMax: 1000 },
      { categorie: 'Haut / Chemise', prixMin: 80, prixMax: 500 },
      { categorie: 'Pantalon', prixMin: 100, prixMax: 600 },
      { categorie: 'Sac', prixMin: 400, prixMax: 3000 },
      { categorie: 'Souliers', prixMin: 150, prixMax: 800 },
    ],
  },
  {
    nom: 'BALMAIN',
    categories: 'Prêt-à-porter (hors formel)',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 150, prixMax: 1200 },
      { categorie: 'Robe', prixMin: 120, prixMax: 800 },
      { categorie: 'Jupe / Short', prixMin: 80, prixMax: 500 },
    ],
  },
  {
    nom: 'BOTTEGA VENETA',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures, souliers',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 200, prixMax: 1500 },
      { categorie: 'Robe', prixMin: 150, prixMax: 1000 },
      { categorie: 'Pull / Gilet', prixMin: 150, prixMax: 800 },
      { categorie: 'Sac', prixMin: 500, prixMax: 3000 },
      { categorie: 'Souliers', prixMin: 200, prixMax: 1000 },
      { categorie: 'Petite maroquinerie', prixMin: 200, prixMax: 1200 },
    ],
  },
  {
    nom: 'BURBERRY',
    categories: 'Prêt-à-porter, maroquinerie, ceintures',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 150, prixMax: 1000 },
      { categorie: 'Pull / Gilet', prixMin: 80, prixMax: 400 },
      { categorie: 'Sac', prixMin: 200, prixMax: 1500 },
    ],
  },
  {
    nom: 'CÉLINE',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, souliers',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 200, prixMax: 1200 },
      { categorie: 'Robe', prixMin: 150, prixMax: 800 },
      { categorie: 'Pantalon', prixMin: 100, prixMax: 600 },
      { categorie: 'Sac', prixMin: 400, prixMax: 2500 },
      { categorie: 'Souliers', prixMin: 150, prixMax: 700 },
      { categorie: 'Petite maroquinerie', prixMin: 150, prixMax: 800 },
    ],
  },
  {
    nom: 'CHANEL',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, bijoux, souliers, ceintures',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 300, prixMax: 2500 },
      { categorie: 'Robe', prixMin: 200, prixMax: 1800 },
      { categorie: 'Jupe / Short', prixMin: 150, prixMax: 800 },
      { categorie: 'Haut / Chemise', prixMin: 80, prixMax: 600 },
      { categorie: 'Pantalon', prixMin: 150, prixMax: 800 },
      { categorie: 'Pull / Gilet', prixMin: 200, prixMax: 1200 },
      { categorie: 'Sac', prixMin: 800, prixMax: 8000 },
      { categorie: 'Souliers', prixMin: 200, prixMax: 1200 },
      { categorie: 'Bijoux', prixMin: 100, prixMax: 3000 },
    ],
  },
  {
    nom: 'CHLOÉ',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures, bijoux',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 100, prixMax: 800 },
      { categorie: 'Robe', prixMin: 80, prixMax: 600 },
      { categorie: 'Sac', prixMin: 200, prixMax: 1500 },
    ],
  },
  {
    nom: 'CHRISTIAN DIOR',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, bijoux, souliers, ceintures',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 250, prixMax: 2000 },
      { categorie: 'Robe', prixMin: 200, prixMax: 1500 },
      { categorie: 'Jupe / Short', prixMin: 120, prixMax: 700 },
      { categorie: 'Haut / Chemise', prixMin: 80, prixMax: 500 },
      { categorie: 'Pantalon', prixMin: 120, prixMax: 700 },
      { categorie: 'Pull / Gilet', prixMin: 150, prixMax: 1000 },
      { categorie: 'Sac', prixMin: 600, prixMax: 6000 },
      { categorie: 'Souliers', prixMin: 150, prixMax: 1000 },
      { categorie: 'Bijoux', prixMin: 80, prixMax: 2000 },
    ],
  },
  {
    nom: 'COMME DES GARÇONS',
    categories: 'Prêt-à-porter, petite maroquinerie, ceintures, souliers',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 100, prixMax: 800 },
      { categorie: 'Robe', prixMin: 80, prixMax: 600 },
      { categorie: 'Pantalon', prixMin: 80, prixMax: 400 },
    ],
  },
  {
    nom: 'COURRÈGES',
    categories: 'Prêt-à-porter, petite maroquinerie, maroquinerie',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 80, prixMax: 600 },
      { categorie: 'Robe', prixMin: 80, prixMax: 500 },
      { categorie: 'Jupe / Short', prixMin: 60, prixMax: 300 },
    ],
  },
  {
    nom: 'DOLCE & GABBANA',
    categories: 'Petite maroquinerie',
    prix: [
      { categorie: 'Petite maroquinerie', prixMin: 80, prixMax: 600 },
    ],
  },
  {
    nom: 'DRIES VAN NOTEN',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 100, prixMax: 800 },
      { categorie: 'Robe', prixMin: 80, prixMax: 600 },
      { categorie: 'Pantalon', prixMin: 80, prixMax: 400 },
    ],
  },
  {
    nom: 'EMILIO PUCCI',
    categories: 'Prêt-à-porter, maroquinerie, ceintures',
    prix: [
      { categorie: 'Robe', prixMin: 80, prixMax: 600 },
      { categorie: 'Haut / Chemise', prixMin: 60, prixMax: 300 },
    ],
  },
  {
    nom: 'FENDI',
    categories: 'Petite maroquinerie',
    prix: [
      { categorie: 'Petite maroquinerie', prixMin: 150, prixMax: 1500 },
    ],
  },
  {
    nom: 'GIORGIO ARMANI',
    categories: 'Prêt-à-porter, maroquinerie',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 80, prixMax: 800 },
      { categorie: 'Pantalon', prixMin: 60, prixMax: 400 },
    ],
  },
  {
    nom: 'GIVENCHY',
    categories: 'Prêt-à-porter, maroquinerie, ceintures',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 100, prixMax: 1000 },
      { categorie: 'Robe', prixMin: 100, prixMax: 800 },
      { categorie: 'Sac', prixMin: 200, prixMax: 1500 },
    ],
  },
  {
    nom: 'GUCCI',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures, bijoux, objets',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 200, prixMax: 1500 },
      { categorie: 'Robe', prixMin: 150, prixMax: 1000 },
      { categorie: 'Sac', prixMin: 400, prixMax: 3000 },
      { categorie: 'Souliers', prixMin: 150, prixMax: 800 },
      { categorie: 'Ceinture', prixMin: 150, prixMax: 600 },
      { categorie: 'Bijoux', prixMin: 100, prixMax: 1000 },
    ],
  },
  {
    nom: 'HELMUT LANG',
    categories: 'Prêt-à-porter',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 80, prixMax: 500 },
      { categorie: 'Pantalon', prixMin: 60, prixMax: 300 },
    ],
  },
  {
    nom: 'HERMÈS',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, souliers, ceintures, bijoux, foulards',
    prix: [
      { categorie: 'Sac', prixMin: 1500, prixMax: 15000 },
      { categorie: 'Foulard', prixMin: 150, prixMax: 800 },
      { categorie: 'Ceinture', prixMin: 150, prixMax: 600 },
      { categorie: 'Veste / Manteau', prixMin: 400, prixMax: 3000 },
      { categorie: 'Bijoux', prixMin: 200, prixMax: 3000 },
      { categorie: 'Petite maroquinerie', prixMin: 300, prixMax: 2000 },
    ],
  },
  {
    nom: 'ISABEL MARANT',
    categories: 'Prêt-à-porter, souliers, maroquinerie',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 80, prixMax: 600 },
      { categorie: 'Robe', prixMin: 60, prixMax: 400 },
      { categorie: 'Souliers', prixMin: 60, prixMax: 350 },
    ],
  },
  {
    nom: 'ISSEY MIYAKE',
    categories: 'Prêt-à-porter, souliers',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 80, prixMax: 600 },
      { categorie: 'Robe', prixMin: 80, prixMax: 500 },
    ],
  },
  {
    nom: 'JACQUEMUS',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie',
    prix: [
      { categorie: 'Robe', prixMin: 80, prixMax: 500 },
      { categorie: 'Haut / Chemise', prixMin: 60, prixMax: 300 },
      { categorie: 'Sac', prixMin: 150, prixMax: 800 },
    ],
  },
  {
    nom: 'JEAN PAUL GAULTIER',
    categories: 'Prêt-à-porter (hors Homme)',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 150, prixMax: 1500 },
      { categorie: 'Robe', prixMin: 120, prixMax: 1000 },
      { categorie: 'Jupe / Short', prixMin: 80, prixMax: 500 },
      { categorie: 'Haut / Chemise', prixMin: 60, prixMax: 400 },
    ],
  },
  {
    nom: 'JUNYA WATANABE',
    categories: 'Prêt-à-porter',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 100, prixMax: 600 },
      { categorie: 'Robe', prixMin: 80, prixMax: 400 },
    ],
  },
  {
    nom: 'KENZO',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 60, prixMax: 400 },
      { categorie: 'Pull / Gilet', prixMin: 50, prixMax: 300 },
    ],
  },
  {
    nom: 'LANVIN',
    categories: 'Petite maroquinerie',
    prix: [
      { categorie: 'Petite maroquinerie', prixMin: 80, prixMax: 500 },
    ],
  },
  {
    nom: 'LEMAIRE',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 100, prixMax: 800 },
      { categorie: 'Pantalon', prixMin: 80, prixMax: 400 },
      { categorie: 'Sac', prixMin: 200, prixMax: 1000 },
    ],
  },
  {
    nom: 'LOEWE',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 150, prixMax: 1000 },
      { categorie: 'Robe', prixMin: 120, prixMax: 800 },
      { categorie: 'Sac', prixMin: 400, prixMax: 2000 },
      { categorie: 'Petite maroquinerie', prixMin: 150, prixMax: 800 },
    ],
  },
  {
    nom: 'LOUIS VUITTON',
    categories: 'Maroquinerie, petite maroquinerie, prêt-à-porter, souliers',
    prix: [
      { categorie: 'Sac', prixMin: 600, prixMax: 5000 },
      { categorie: 'Petite maroquinerie', prixMin: 200, prixMax: 1500 },
      { categorie: 'Veste / Manteau', prixMin: 200, prixMax: 1500 },
      { categorie: 'Souliers', prixMin: 150, prixMax: 800 },
    ],
  },
  {
    nom: 'MARGIELA',
    categories: 'Prêt-à-porter, maroquinerie',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 150, prixMax: 1000 },
      { categorie: 'Robe', prixMin: 100, prixMax: 700 },
      { categorie: 'Haut / Chemise', prixMin: 60, prixMax: 400 },
      { categorie: 'Pantalon', prixMin: 80, prixMax: 500 },
      { categorie: 'Sac', prixMin: 200, prixMax: 1200 },
    ],
  },
  {
    nom: 'MARINE SERRE',
    categories: 'Prêt-à-porter',
    prix: [
      { categorie: 'Robe', prixMin: 80, prixMax: 500 },
      { categorie: 'Haut / Chemise', prixMin: 60, prixMax: 300 },
    ],
  },
  {
    nom: 'MAX MARA',
    categories: 'Manteaux, souliers',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 150, prixMax: 1200 },
      { categorie: 'Souliers', prixMin: 80, prixMax: 400 },
    ],
  },
  {
    nom: 'MISSONI',
    categories: 'Prêt-à-porter, petite maroquinerie, souliers',
    prix: [
      { categorie: 'Robe', prixMin: 80, prixMax: 600 },
      { categorie: 'Pull / Gilet', prixMin: 80, prixMax: 500 },
    ],
  },
  {
    nom: 'MIU MIU',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, souliers',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 150, prixMax: 1000 },
      { categorie: 'Robe', prixMin: 120, prixMax: 800 },
      { categorie: 'Jupe / Short', prixMin: 100, prixMax: 500 },
      { categorie: 'Sac', prixMin: 300, prixMax: 1500 },
      { categorie: 'Souliers', prixMin: 150, prixMax: 700 },
    ],
  },
  {
    nom: 'MONCLER',
    categories: 'Prêt-à-porter, maroquinerie',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 300, prixMax: 2000 },
    ],
  },
  {
    nom: 'NINA RICCI',
    categories: 'Prêt-à-porter, maroquinerie',
    prix: [
      { categorie: 'Robe', prixMin: 60, prixMax: 400 },
      { categorie: 'Veste / Manteau', prixMin: 80, prixMax: 500 },
    ],
  },
  {
    nom: 'PACO RABANNE',
    categories: 'Prêt-à-porter, maroquinerie',
    prix: [
      { categorie: 'Robe', prixMin: 80, prixMax: 600 },
      { categorie: 'Haut / Chemise', prixMin: 60, prixMax: 300 },
    ],
  },
  {
    nom: 'PRADA',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, souliers, ceintures',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 200, prixMax: 1500 },
      { categorie: 'Robe', prixMin: 150, prixMax: 1000 },
      { categorie: 'Sac', prixMin: 400, prixMax: 3000 },
      { categorie: 'Souliers', prixMin: 150, prixMax: 800 },
      { categorie: 'Petite maroquinerie', prixMin: 150, prixMax: 800 },
    ],
  },
  {
    nom: 'RICK OWENS',
    categories: 'Prêt-à-porter',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 150, prixMax: 1200 },
      { categorie: 'Pantalon', prixMin: 100, prixMax: 600 },
      { categorie: 'Souliers', prixMin: 150, prixMax: 800 },
    ],
  },
  {
    nom: 'ROBERTO CAVALLI',
    categories: 'Prêt-à-porter, maroquinerie',
    prix: [
      { categorie: 'Robe', prixMin: 80, prixMax: 600 },
      { categorie: 'Veste / Manteau', prixMin: 100, prixMax: 700 },
    ],
  },
  {
    nom: 'SACAI',
    categories: 'Prêt-à-porter',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 100, prixMax: 800 },
      { categorie: 'Robe', prixMin: 80, prixMax: 500 },
    ],
  },
  {
    nom: 'SAINT LAURENT',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures, bijoux, foulards',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 200, prixMax: 1500 },
      { categorie: 'Robe', prixMin: 150, prixMax: 800 },
      { categorie: 'Jupe / Short', prixMin: 100, prixMax: 500 },
      { categorie: 'Haut / Chemise', prixMin: 80, prixMax: 400 },
      { categorie: 'Pantalon', prixMin: 100, prixMax: 600 },
      { categorie: 'Sac', prixMin: 400, prixMax: 2500 },
      { categorie: 'Ceinture', prixMin: 100, prixMax: 500 },
      { categorie: 'Bijoux', prixMin: 80, prixMax: 800 },
    ],
  },
  {
    nom: 'SCHIAPARELLI',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, bijoux, ceintures',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 200, prixMax: 2000 },
      { categorie: 'Robe', prixMin: 150, prixMax: 1500 },
      { categorie: 'Bijoux', prixMin: 100, prixMax: 1000 },
    ],
  },
  {
    nom: 'STELLA MC CARTNEY',
    categories: 'Prêt-à-porter, maroquinerie',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 100, prixMax: 800 },
      { categorie: 'Robe', prixMin: 80, prixMax: 600 },
      { categorie: 'Sac', prixMin: 150, prixMax: 800 },
    ],
  },
  {
    nom: 'THE ROW',
    categories: 'Prêt-à-porter, maroquinerie, souliers',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 200, prixMax: 2000 },
      { categorie: 'Pantalon', prixMin: 150, prixMax: 800 },
      { categorie: 'Sac', prixMin: 400, prixMax: 3000 },
    ],
  },
  {
    nom: 'THIERRY MUGLER',
    categories: 'Prêt-à-porter (hors Homme)',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 200, prixMax: 2000 },
      { categorie: 'Robe', prixMin: 150, prixMax: 1500 },
      { categorie: 'Jupe / Short', prixMin: 100, prixMax: 600 },
      { categorie: 'Haut / Chemise', prixMin: 80, prixMax: 400 },
      { categorie: 'Pantalon', prixMin: 100, prixMax: 600 },
    ],
  },
  {
    nom: 'VALENTINO',
    categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures, bijoux, souliers',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 150, prixMax: 1500 },
      { categorie: 'Robe', prixMin: 150, prixMax: 1200 },
      { categorie: 'Sac', prixMin: 300, prixMax: 2000 },
      { categorie: 'Souliers', prixMin: 150, prixMax: 800 },
    ],
  },
  {
    nom: 'VERSACE',
    categories: 'Prêt-à-porter, maroquinerie, ceintures, bijoux',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 150, prixMax: 1200 },
      { categorie: 'Robe', prixMin: 120, prixMax: 800 },
      { categorie: 'Bijoux', prixMin: 80, prixMax: 600 },
    ],
  },
  {
    nom: 'VIVIENNE WESTWOOD',
    categories: 'Prêt-à-porter, petite maroquinerie, maroquinerie, foulards, ceintures, bijoux',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 100, prixMax: 800 },
      { categorie: 'Robe', prixMin: 80, prixMax: 600 },
      { categorie: 'Bijoux', prixMin: 50, prixMax: 400 },
    ],
  },
  {
    nom: 'YOHJI YAMAMOTO',
    categories: 'Prêt-à-porter',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 100, prixMax: 1000 },
      { categorie: 'Pantalon', prixMin: 80, prixMax: 500 },
    ],
  },
  {
    nom: 'YVES SAINT LAURENT',
    categories: 'Prêt-à-porter',
    prix: [
      { categorie: 'Veste / Manteau', prixMin: 100, prixMax: 800 },
      { categorie: 'Robe', prixMin: 80, prixMax: 600 },
    ],
  },
  {
    nom: 'ZIMMERMANN',
    categories: 'Prêt-à-porter',
    prix: [
      { categorie: 'Robe', prixMin: 80, prixMax: 600 },
      { categorie: 'Haut / Chemise', prixMin: 60, prixMax: 300 },
    ],
  },
]

export function getPrixRange(marque: string, categorie: string): { min: number, max: number } | null {
  const m = MARQUES_DEPOSANTE.find(m => m.nom.toLowerCase() === marque.toLowerCase())
  if (!m?.prix) return null
  const cat = m.prix.find(p => categorie.toLowerCase().includes(p.categorie.toLowerCase()))
  if (!cat) return null
  return { min: cat.prixMin, max: cat.prixMax }
}

export function getPrixRange(marque: string, categorie: string): { min: number, max: number } | null {
  const m = MARQUES_DEPOSANTE.find(m => m.nom.toLowerCase() === marque.toLowerCase())
  if (!m?.prix) return null
  const cat = m.prix.find(p => categorie.toLowerCase().includes(p.categorie.toLowerCase()))
  if (!cat) return null
  return { min: cat.prixMin, max: cat.prixMax }
}

export const NOMS_MARQUES_DEPOSANTE = MARQUES_DEPOSANTE.map(m => m.nom)