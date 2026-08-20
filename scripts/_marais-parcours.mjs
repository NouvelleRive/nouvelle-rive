import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const g=(q)=>`https://www.google.com/maps/search/${encodeURIComponent(q)}`
const SEC3=`## 3. Le fripe trip : le parcours idéal

::map friperie vintage Le Marais Paris

**Départ : métro Saint-Paul.** À la sortie, prenez à droite : vous entrez dans le Marais historique. Ruelles pavées, maisons de guingois, petite agitation joyeuse — c'est le coin le plus charmant.

**Rue des Écouffes**, l'ancienne « rue aux filles » (et la « rue aux vêtements »). Première étape fripe : **NOUVELLE RIVE**, au 8, installée dans l'ancienne première boîte lesbienne du Marais, le 3W (Women with Women) — on voit encore le fumoir en bas, et la caisse trône sur l'ancienne cabine du DJ. Chaque portant y est tenu par une créatrice différente, de la pièce à moins de 20 € au vintage de luxe.

En chemin, vous passez tout près de la [synagogue de la rue Pavée](${g("Synagogue rue Pavée Guimard Paris")}) et sa façade Art nouveau signée Guimard.

**Rue des Rosiers**, le cœur du quartier juif. Goûtez le falafel historique, mais aussi les classiques ashkénazes des delis : pastrami, latkes, strudel et cheesecake (vatrouchka). C'est surtout le vendredi, veille de Shabbat, et les jours de fête qu'on croise la communauté religieuse. ⚠️ À savoir : le samedi (Shabbat), une grande partie du quartier juif est fermée.

Remontez ensuite jusqu'au [musée Carnavalet](${g("Musée Carnavalet Paris")}), superbe hôtel particulier, et faites un stop [place des Vosges](${g("Place des Vosges Paris")}) — où les Parisien·nes s'étendent sur l'herbe au moindre rayon de soleil.

**Prêt·es à remonter la rue de Turenne ?** Parmi nos boutiques préférées : [The Selection](${g("The Selection vintage rue de Turenne Paris")}), [Anashi](${g("Anashi vintage Paris Marais")}) et [Nuovo](${g("Nuovo vintage Paris Marais")}). Vous y trouverez aussi [Kanelle Vintage](${g("Kanelle Vintage Paris Marais")}), spécialisée dans la lingerie. Dans les rues parallèles, jetez un œil chez [Revoir Vintage](${g("Revoir Vintage rue Commines Paris")}) (rue Commines) et [The Parisian Vintage](${g("The Parisian Vintage rue Saint-Claude Paris")}) (rue Saint-Claude).

**Direction la rue de Bretagne**, où vous pourrez passer chez [KIS](${g("KIS vintage rue de Bretagne Paris")}) mais aussi chez [Antic Tonic](${g("Antic Tonic bijoux Paris Marais")}), spécialisée en bijoux. Et ne manquez pas le [marché des Enfants Rouges](${g("Marché des Enfants Rouges Paris")}), le plus vieux marché couvert de Paris (1615), pour une pause gourmande.

Après la boucle, repassez par NOUVELLE RIVE : de nouvelles pièces sont peut-être arrivées entre-temps.

Les bons réflexes :
- Venez en début de semaine ou en matinée : la sélection est fraîche et moins fouillée.
- Renseignez-vous sur les arrivages : certaines adresses (dont la nôtre) renouvellent leurs pièces plusieurs fois par jour.
- Essayez systématiquement : les coupes vintage taillent différemment d'aujourd'hui.
- Sur le luxe, vérifiez l'authenticité — ou achetez dans un lieu qui la garantit.

`
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  const s='## 3. Le fripe trip : le parcours idéal'
  const e='## 4. Où déjeuner'
  const i=a.body.indexOf(s), j=a.body.indexOf(e)
  if(i<0||j<0){ console.log('ancres introuvables'); process.exit(1) }
  a.body=a.body.slice(0,i)+SEC3+a.body.slice(j)
  console.log('OK parcours reecrit,', a.body.split(/\s+/).length,'mots')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
