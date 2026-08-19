import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })

const body = `Le Marais est LE quartier du vintage à Paris. En une après-midi, à pied, on peut y enchaîner friperies au kilo, dépôts-ventes de luxe et pépites de créateurs. Voici l'itinéraire idéal pour chiner sans s'épuiser — et sans rien rater.

## Avant de partir : les bons repères

Le terrain de jeu se déploie entre les 3e et 4e arrondissements, autour de quelques stations : Saint-Paul (ligne 1), Hôtel de Ville, Rambuteau, Chemin Vert et Filles du Calvaire. Prévoyez une demi-journée, des chaussures confortables et l'esprit ouvert : les meilleures trouvailles se méritent en fouillant, portant par portant.

## Le point de départ : 8 rue des Écouffes

Commencez par NOUVELLE RIVE, au 8 rue des Écouffes, en plein cœur du Marais. Chaque portant y est tenu par une créatrice ou curateurice différente — vintage, upcyclé, régénéré, de la pièce à moins de 20 € au vintage de luxe. Le bon endroit pour vous mettre en jambes… et repartir avec une première pépite. Ouvert 11h–20h, 7j/7, à deux pas du métro Saint-Paul.

## Étape 1 — Le cœur historique : rues des Rosiers, des Écouffes et du Roi de Sicile

Autour de la rue des Rosiers, l'ancienne « rue aux vêtements », se concentrent les adresses les plus emblématiques : friperies au kilo pour les petits budgets, sélections vintage triées, dépôts-ventes. C'est ici qu'on déniche le basique parfait ou la pièce des années 90 pour quelques euros. Prenez votre temps : dans une bonne fripe, la trouvaille est au fond du portant.

## Étape 2 — Vers la rue de la Verrerie et la rue du Temple

En remontant vers l'Hôtel de Ville, l'ambiance devient plus streetwear et vintage de créateur : denim d'époque, pièces sportswear, accessoires, coupes oversize. Un bon coin pour les amatrices et amateurs de Y2K et de pièces qui ont du caractère.

## Étape 3 — Le Haut-Marais, plus pointu : Turenne, Charlot, Bretagne

Passé la rue de Bretagne et vers les Filles du Calvaire, on entre dans le Marais des concept stores et des sélections pointues : archives de créateurs, vintage de luxe, pièces rares. Les prix montent, la curation aussi. Profitez-en pour faire une pause au marché des Enfants Rouges (rue de Bretagne), le plus vieux marché couvert de Paris, avant de repartir chiner.

## Chiner selon son budget

Le Marais a l'avantage de couvrir toutes les envies :
- Petit budget : friperies au kilo et fripes à petits prix, pour le basique ou la pièce à retravailler.
- Budget moyen : vintage de créateur et sélections triées, pour chiner sans fouiller.
- Coup de cœur : dépôts-ventes et vintage de luxe, pour la pièce d'exception, authentifiée.

## Les bons réflexes du tour

- Venez en début de semaine ou en matinée : la sélection est fraîche et moins fouillée.
- Renseignez-vous sur les arrivages : certaines adresses (dont la nôtre) renouvellent leurs pièces plusieurs fois par jour.
- Essayez systématiquement : les coupes vintage taillent différemment d'aujourd'hui.
- Sur le luxe, vérifiez l'authenticité — ou achetez dans un lieu qui la garantit.
- Fixez-vous un budget par étape pour ne pas tout dépenser à la première boutique.

## Terminez là où vous avez commencé

Après votre boucle, repassez par NOUVELLE RIVE : entre-temps, de nouvelles pièces sont peut-être arrivées. C'est ça, la magie du Marais — la sélection change tout le temps.

> Le Marais ne se visite pas, il se chine.`

const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
let ok=false
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  a.body=body
  a.description="Un itinéraire à pied pour chiner le vintage dans le Marais : rues, métros, friperies au kilo, dépôts-ventes de luxe et bons réflexes, depuis NOUVELLE RIVE."
  a.readingMinutes=6
  a.category='LE MARAIS'
  a.cta={ href:'/nous-rencontrer', label:'Venir nous voir →' }
  ok=true
  console.log('✓ rédigé,', body.split(/\s+/).length, 'mots')
}
if(!ok) console.log('✗ article non trouvé')
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
