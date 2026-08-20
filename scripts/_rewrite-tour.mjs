import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const g = (q) => `https://www.google.com/maps/search/${encodeURIComponent(q)}`
const body = `Le Marais est LE quartier du vintage à Paris. Mais chaque coin a son ambiance : d'un côté le Marais historique, populaire et pavé ; de l'autre le Haut Marais, plus chic et pointu. Voici un vrai tour, zone par zone — où chiner, où déjeuner, et où prendre le meilleur café.

## La carte des friperies du Marais

::map friperie vintage Le Marais Paris

## Zone 1 — Le Marais historique (autour de la rue des Rosiers)

Ambiance : ruelles pavées, esprit village, mélange de friperies au kilo à petits prix, de dépôts-ventes et de vintage trié. C'est le Marais populaire et vivant, celui où l'on fouille et où l'on trouve. On y vient pour le basique parfait comme pour la pièce des années 90 à quelques euros.

C'est ici qu'on est, au 8 rue des Écouffes : NOUVELLE RIVE, votre point de départ. Chaque portant y est tenu par une créatrice différente — de la pièce à moins de 20 € au vintage de luxe.

**Pour déjeuner** : le falafel mythique de [L'As du Fallafel](${g("L'As du Fallafel rue des Rosiers Paris")}) rue des Rosiers, ou une pause plus arty au café de la [Fondation Azzedine Alaïa](${g("Fondation Azzedine Alaia Paris")}).

**Pour un café ou un matcha (et une belle photo)** : [Pasa Dena](${g("Pasa Dena Paris")}) et [Joho](${g("Joho cafe Paris Marais")}), nos adresses préférées du coin.

## Zone 2 — Le Haut Marais (Turenne, Charlot, Bretagne)

Ambiance : plus chic, plus calme, plus pointu. Place aux concept stores, aux archives de créateurs et au vintage de luxe. Les prix montent, la curation aussi — c'est le Marais des connaisseuses et connaisseurs, celui où l'on chine sans fouiller.

**Pour déjeuner** : direction le [Marché des Enfants Rouges](${g("Marché des Enfants Rouges Paris")}), le plus vieux marché couvert de Paris, pour manger sur le pouce entre deux boutiques.

**Pour un café ou un matcha** : [Merlot](${g("Merlot cafe Haut Marais Paris")}), la bonne adresse du Haut Marais.

## Les bons réflexes du tour

- Venez en début de semaine ou en matinée : la sélection est fraîche et moins fouillée.
- Renseignez-vous sur les arrivages : certaines adresses (dont la nôtre) renouvellent leurs pièces plusieurs fois par jour.
- Essayez systématiquement : les coupes vintage taillent différemment d'aujourd'hui.
- Sur le luxe, vérifiez l'authenticité — ou achetez dans un lieu qui la garantit.

## Terminez là où vous avez commencé

Après votre boucle, repassez par NOUVELLE RIVE : de nouvelles pièces sont peut-être arrivées entre-temps. C'est ça, la magie du Marais — la sélection change tout le temps.

> Le Marais ne se visite pas, il se chine.`

const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){ a.body=body; a.readingMinutes=6; console.log('✓ réécrit,', body.split(/\s+/).length,'mots') }
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
