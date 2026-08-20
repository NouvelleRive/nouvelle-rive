import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const g=(q)=>`https://www.google.com/maps/search/${encodeURIComponent(q)}`
const body=`Le Marais est LE quartier du vintage à Paris — et bien plus encore. Voici tout pour un vrai « fripe trip » : le quartier, ses deux visages, le parcours idéal, et où faire une pause.

## 1. Le Marais en général

Chargé d'histoire, le Marais dégage une atmosphère à la fois intemporelle et cosmopolite, portée par la variété de ses styles architecturaux. C'est le seul quartier de Paris à avoir conservé ses ruelles étroites et ses immeubles parfois biscornus d'avant la Révolution, épargné par les grands travaux du baron Haussmann en 1853 : il recèle mille secrets du passé de Paris. Au fil des siècles, il est devenu synonyme de boutiques tendance, de créateurs indépendants et de galeries d'art — tout en gardant son charme historique, on le voit aujourd'hui comme un repaire avant-gardiste de la mode, qui attire les passionnées et passionnés de style comme les acheteuses et acheteurs les plus exigeants. Des grandes maisons aux jeunes labels : une expérience de shopping unique et variée.

Réputé pour son inclusivité et sa tradition d'accueil, le Marais a fait de son ouverture affichée à la communauté LGBTQ+ un lieu sûr : bars et clubs s'adressent à toutes les orientations, et dans ses rues vivantes, chacune et chacun peut être pleinement soi-même et se sentir chez soi. Une atmosphère de chaleur, de diversité et de fête. Le Marais invite à explorer ses ruelles sinueuses et ne cesse jamais de surprendre.

## 2. Les deux Marais

Le Marais se scinde en deux zones principales, chacune avec son ambiance.

**Le Marais historique** (autour de la rue des Rosiers) : populaire et pavé. Avant de devenir le terrain de jeu de l'aristocratie française aux XVIIe et XVIIIe siècles, il a joué un rôle majeur comme quartier juif depuis le Moyen Âge. Cet héritage laisse encore des traces : des religieux se promènent rue des Rosiers, tout près de l'une des plus anciennes synagogues de Paris, et l'on y déguste parmi les meilleurs restaurants ashkénazes et séfarades de la ville. Les opulents hôtels particuliers rappellent l'époque où le quartier logeait la noblesse. Les rues elles-mêmes racontent tout ça : la rue des Écouffes était « la rue aux vêtements » et l'ancienne rue aux filles ; à deux pas, la rue des Mauvais Garçons. Ambiance pavés, esprit village, et une vraie densité de friperies au kilo, de dépôts-ventes et de vintage de créateur.

**Le Haut Marais** (autour d'Arts et Métiers) : plus tranquille et décontracté. Un Marais au rythme doux — cafés et restos cosy, concept stores, galeries d'art et vintage — parfait pour flâner sans se presser.

## 3. Le fripe trip : le parcours idéal

::map friperie vintage Le Marais Paris

Le point de départ, c'est NOUVELLE RIVE, au 8 rue des Écouffes. Le lieu a une histoire : c'était la première boîte lesbienne du Marais, le 3W (Women with Women). On peut encore voir le fumoir en bas — et la caisse est posée sur l'ancienne cabine du DJ. Aujourd'hui, chaque portant y est tenu par une créatrice différente, de la pièce à moins de 20 € au vintage de luxe.

De là, remontez la rue des Rosiers et ses alentours (rue des Écouffes, rue du Roi de Sicile) pour les friperies au kilo et les dépôts-ventes ; puis filez vers le Haut Marais (Turenne, Charlot, Bretagne) pour les concept stores et le vintage plus pointu. Après la boucle, repassez par NOUVELLE RIVE : de nouvelles pièces sont peut-être arrivées entre-temps.

Les bons réflexes :
- Venez en début de semaine ou en matinée : la sélection est fraîche et moins fouillée.
- Renseignez-vous sur les arrivages : certaines adresses (dont la nôtre) renouvellent leurs pièces plusieurs fois par jour.
- Essayez systématiquement : les coupes vintage taillent différemment d'aujourd'hui.
- Sur le luxe, vérifiez l'authenticité — ou achetez dans un lieu qui la garantit.

## 4. Où déjeuner

- Dans le Marais historique : le falafel mythique de [L'As du Fallafel](${g("L'As du Fallafel rue des Rosiers Paris")}) rue des Rosiers, une pause plus arty au café de la [Fondation Azzedine Alaïa](${g("Fondation Azzedine Alaia Paris")}), ou une bonne table [Chez Anna](${g("Chez Anna restaurant Marais Paris")}).
- Dans le Haut Marais : le [Marché des Enfants Rouges](${g("Marché des Enfants Rouges Paris")}), le plus vieux marché couvert de Paris (1615) — ses petits stands de cuisine du monde (marocain, italien, japonais…) sont parfaits pour manger sur le pouce entre deux boutiques.

## 5. Où prendre un café

- Dans le Marais historique : [Pasa Dena](${g("Pasa Dena Paris")}) et [Joho](${g("Joho cafe Paris Marais")}) — hyper bons, hyper photogéniques.
- Dans le Haut Marais : [Merlot](${g("Merlot cafe Haut Marais Paris")}).

## À ne pas manquer

Au-delà des boutiques, le Marais mérite qu'on lève le nez :
- La [place des Vosges](${g("Place des Vosges Paris")}) : la plus ancienne place royale de Paris, ses arcades et son jardin.
- La [rue des Rosiers](${g("Rue des Rosiers Paris")}) : le cœur battant du quartier juif.
- Le [musée Carnavalet](${g("Musée Carnavalet Paris")}) : toute l'histoire de Paris (collections permanentes gratuites).
- L'[Hôtel de Ville](${g("Hotel de Ville Paris")}) : la façade monumentale et son parvis, aux portes du Marais.

> Le Marais ne se visite pas, il se chine.`

const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){ a.body=body; console.log('OK restructure,', body.split(/\s+/).length, 'mots') }
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
