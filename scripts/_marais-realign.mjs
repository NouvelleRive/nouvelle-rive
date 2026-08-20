import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })

const INTRO=`Le Marais est LE quartier du vintage à Paris — et bien plus encore. Chargé d'histoire, il dégage une atmosphère à la fois intemporelle et cosmopolite, portée par la variété de ses styles architecturaux. Au fil des siècles, il est devenu synonyme de boutiques tendance, de créateurs indépendants et de galeries d'art : tout en gardant son charme historique, on le voit aujourd'hui comme un repaire avant-gardiste de la mode, qui attire les passionnées et passionnés de style comme les acheteuses et acheteurs les plus exigeants. Des grandes maisons aux jeunes labels, il offre une expérience de shopping unique et variée. Le Marais se scinde en deux zones principales : le Marais historique, populaire et pavé, et le Haut Marais, plus tranquille et décontracté — chacune avec son ambiance. Voici un vrai tour, zone par zone : où chiner, où déjeuner et où prendre le meilleur café.`

const Z1=`Le Marais est le seul quartier de Paris à avoir conservé ses ruelles étroites et ses immeubles parfois biscornus d'avant la Révolution, épargné par les grands travaux du baron Haussmann en 1853. Il recèle mille secrets du passé de Paris. Avant de devenir le terrain de jeu de l'aristocratie française aux XVIIe et XVIIIe siècles, il a joué un rôle majeur comme quartier juif depuis le Moyen Âge. Aujourd'hui plus discret, cet héritage laisse encore des traces : des religieux se promènent rue des Rosiers, tout près de l'une des plus anciennes synagogues de Paris, et l'on y déguste parmi les meilleurs restaurants ashkénazes et séfarades de la ville. Les opulents hôtels particuliers, eux, rappellent avec élégance l'époque où le quartier logeait la noblesse — couche après couche d'histoire. C'est sûrement pour tout cela que créatrices, créateurs et artisans en ont fait leur quartier de prédilection.

Le Marais est aussi réputé pour son inclusivité et sa tradition d'accueil. Son ouverture affichée à la communauté LGBTQ+ en a fait un lieu sûr, où règne une atmosphère de chaleur, de diversité et de fête. Ses nombreux bars, clubs et adresses s'adressent à toutes les orientations, et dans ses rues vivantes, chacune et chacun — religieux, filles et gays, fashionistas, amateurs et amatrices d'art, fêtards et fêtardes — peut être pleinement soi-même et se sentir chez soi. Les rues elles-mêmes racontent tout ça : la rue des Écouffes, où l'on est, était « la rue aux vêtements » et l'ancienne rue aux filles ; à deux pas, la rue des Mauvais Garçons. En somme, le Marais invite à explorer ses ruelles sinueuses et ne cesse jamais de surprendre — qu'on y cherche une découverte historique, un grand musée, une expérience mode ou simplement un sentiment d'appartenance.

Côté chine, ambiance pavés et esprit village, avec une vraie densité de friperies au kilo, de dépôts-ventes et de vintage de créateur.`

const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  let b=a.body
  const iCarte=b.indexOf('## La carte des friperies du Marais')
  const Z1H='## Zone 1 — Le Marais historique (autour de la rue des Rosiers)'
  const iNR=b.indexOf('Notre point de départ, c'+String.fromCharCode(39)+'est NOUVELLE RIVE')
  if(iCarte<0||b.indexOf(Z1H)<0||iNR<0){ console.log('ancres introuvables, abort'); process.exit(1) }
  b = INTRO + '\n\n' + b.slice(iCarte)
  const iZ1 = b.indexOf(Z1H); const headEnd = iZ1 + Z1H.length
  const iNR2 = b.indexOf('Notre point de départ, c'+String.fromCharCode(39)+'est NOUVELLE RIVE')
  b = b.slice(0, headEnd) + '\n\n' + Z1 + '\n\n' + b.slice(iNR2)
  a.body=b
  console.log('OK realign,', b.split(/\s+/).length, 'mots')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
