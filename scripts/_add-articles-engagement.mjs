import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })

const ouighours = {
  slug: 'travail-force-ouighours-mode',
  title: 'Travail forcé des Ouïghours : le côté obscur de nos vêtements',
  description: "Ce qui se passe au Xinjiang, les preuves, ce qui a été fait, la « liste de la honte » de Glucksmann : enquête sur le travail forcé ouïghour dans la mode.",
  category: 'ENGAGEMENT',
  date: '2026-09-06',
  readingMinutes: 6,
  relu: false, published: false,
  cta: { href: '/manifesto', label: 'Lire notre manifesto →' },
  sources: [
    { label: "ASPI — Uyghurs for sale (rapport, 2020)", url: 'https://www.aspi.org.au/report/uyghurs-sale' },
    { label: "Coalition to End Uyghur Forced Labour", url: 'https://enduyghurforcedlabour.org/fashion/' },
    { label: "Business & Human Rights Resource Centre — 83 marques", url: 'https://www.business-humanrights.org/en/latest-news/china-83-major-brands-implicated-in-report-on-forced-labour-of-ethnic-minorities-from-xinjiang-assigned-to-factories-across-provinces-includes-company-responses/' },
  ],
  body: `Derrière un t-shirt à 5 €, il y a parfois l'une des pires atrocités de notre époque. Dans la région du Xinjiang, en Chine, la minorité ouïghoure — musulmane et turcophone — subit une répression massive. Et une partie de nos vêtements en porte la trace. Voici ce qui se passe, les preuves, ce qui a été fait, et pourquoi le vintage est une façon de refuser d'y participer.

## Ce qui se passe au Xinjiang

Depuis 2017, des centaines de milliers d'Ouïghours ont été internés dans des camps que Pékin qualifie de « rééducation ». Au-delà de l'enfermement, un système de « transferts de main-d'œuvre » (le programme dit « Xinjiang Aid ») envoie des Ouïghoures et Ouïghours travailler, sous contrainte, dans des usines à travers toute la Chine. Or le Xinjiang produit l'essentiel du coton chinois — environ un cinquième du coton mondial. Autrement dit : une immense partie de l'habillement de la planète passe, à un moment, par cette région.

## Les preuves

Ce ne sont pas des rumeurs. En 2020, l'Australian Strategic Policy Institute (ASPI) a documenté le transfert d'au moins 80 000 Ouïghours vers des usines hors du Xinjiang, et identifié 83 marques internationales — de grands noms de la mode comme de la tech — potentiellement liées à ce travail forcé. Des enquêtes ont montré des ouvrières et ouvriers envoyés directement depuis les camps vers des usines fournissant des multinationales. Images satellites, documents officiels chinois, témoignages : le faisceau de preuves est accablant.

## Ce qui a été fait

Face au scandale, les États-Unis ont adopté en 2022 l'Uyghur Forced Labor Prevention Act (UFLPA) : la loi présume que tout produit fabriqué, même en partie, dans la région ouïghoure est issu du travail forcé, et en interdit l'importation. Des milliards de dollars de marchandises ont depuis été bloqués aux frontières américaines. En Europe, une coalition internationale (End Uyghur Forced Labour) et des élus ont poussé pour une interdiction équivalente ; un règlement européen contre les produits issus du travail forcé a fini par être adopté, mais son application reste un combat.

## La « liste de la honte » de Glucksmann

En France, l'eurodéputé Raphaël Glucksmann a popularisé le sujet avec sa « liste de la honte » : plusieurs dizaines de grandes marques (mode, électronique, automobile) accusées de profiter du travail forcé ouïghour. On y a vu passer des noms comme Nike, Zara, Gap, Puma, Fila ou Apple. Publiée en 2021 et relancée régulièrement pour maintenir la pression, elle a poussé plusieurs marques à s'engager publiquement à sortir de ces chaînes d'approvisionnement.

## Pourquoi le vintage est une réponse

Acheter une pièce de seconde main, c'est refuser de financer une nouvelle production — et donc cette chaîne-là. Le vintage ne réclame pas de nouveau coton, pas de nouvelle usine, pas de nouvelle exploitation. C'est une façon concrète, à notre échelle, de ne pas détourner le regard.

> Ce n'est pas parce qu'on ne le voit pas que ça n'existe pas.

Chez NOUVELLE RIVE, chaque pièce a déjà vécu : en la choisissant, vous sortez du circuit du neuf — et de ce qu'il cache.`,
}

const rana = {
  slug: 'rana-plaza-fast-fashion',
  title: 'Rana Plaza : le jour où la fast fashion s’est effondrée',
  description: "24 avril 2013, Bangladesh : l'effondrement du Rana Plaza fait 1 134 morts. Retour sur la pire catastrophe de l'histoire de la mode et ce qu'elle a changé.",
  category: 'ENGAGEMENT',
  date: '2026-09-07',
  readingMinutes: 5,
  relu: false, published: false,
  cta: { href: '/manifesto', label: 'Lire notre manifesto →' },
  sources: [
    { label: "OIT — Rana Plaza, dix ans après", url: 'https://webapps.ilo.org/infostories/en-GB/Stories/Country-Focus/rana-plaza.html' },
    { label: "Clean Clothes Campaign — Rana Plaza", url: 'https://cleanclothes.org/campaigns/past/rana-plaza' },
    { label: "Business & Human Rights Resource Centre — Rana Plaza", url: 'https://www.business-humanrights.org/en/latest-news/rana-plaza-building-collapse-april-2013/' },
  ],
  body: `Le 24 avril 2013, à Savar, près de Dacca (Bangladesh), un immeuble de huit étages s'effondre. À l'intérieur, des milliers d'ouvrières et d'ouvriers du textile qui cousaient les vêtements de grandes marques occidentales. Bilan : 1 134 morts. C'est la pire catastrophe industrielle de l'histoire de la mode — et le symbole de ce que coûte vraiment un vêtement trop bon marché.

## Ce qui s'est passé

La veille du drame, des fissures apparaissent dans les murs du Rana Plaza. La banque et les commerces du rez-de-chaussée ferment par précaution. Mais les ouvrières et ouvriers des ateliers de confection, eux, sont sommés de retourner travailler sous peine de perdre leur salaire. Le lendemain matin, le bâtiment s'effondre en quelques secondes. Les secours mettront dix-neuf jours à fouiller les décombres : 1 134 personnes mortes, environ 2 500 blessées, beaucoup mutilées à vie.

## Les marques concernées

Le Rana Plaza abritait plusieurs ateliers qui fabriquaient pour de grandes enseignes internationales. Parmi les noms cités après le drame : Benetton, Mango, Primark, Walmart, KiK ou The Children's Place. Des étiquettes retrouvées dans les décombres ont permis de relier la catastrophe à des marques que nous connaissons toutes.

## Ce que ça a changé

Sous la pression internationale, plus de 200 marques et syndicats ont signé l'Accord sur la sécurité incendie et des bâtiments au Bangladesh, un texte contraignant qui a permis d'inspecter des milliers d'usines et de sauver des vies. Un fonds d'indemnisation a été mis en place pour les victimes et leurs familles. Mais dix ans plus tard, les salaires des ouvrières du textile restent parmi les plus bas du monde, et la pression sur les prix — celle de la fast fashion — continue de peser sur leur sécurité.

## Ce qu'on en retient

Rana Plaza a rendu visible l'invisible : chaque vêtement neuf a un coût humain, quelque part dans le monde. Acheter en seconde main, c'est sortir de cette chaîne — ne pas commander une nouvelle pièce cousue à l'autre bout du monde, dans des conditions qu'on ne verra jamais.

> Personne ne devrait mourir pour un t-shirt.

Chez NOUVELLE RIVE, on préfère faire vivre ce qui existe déjà — belles pièces, secondes vies, et pas une couture de plus au prix d'une vie.`,
}

const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const art of [ouighours, rana]){
  const i=articles.findIndex(a=>a.slug===art.slug)
  if(i===-1){ articles.unshift(art); console.log('✓ créé:',art.slug,'('+art.body.split(/\s+/).length+' mots)') }
  else { articles[i]={...articles[i],...art}; console.log('· maj:',art.slug) }
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
console.log('total articles:',articles.length)
process.exit(0)
