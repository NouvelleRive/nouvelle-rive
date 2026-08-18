// Pose la version finale (utilisatrice) de l'article dépôt-vente + liens cliquables + CTA conditions.
// Corrige aussi 2 derniers "un professionnel" restants (apostrophes droites) dans d'autres articles.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  })
}

const DEPOT_BODY = `Un sac, un manteau ou une paire de souliers de créateur dort dans votre dressing ? Le dépôt-vente est la façon la plus simple de lui offrir une seconde vie — et de le transformer en argent — sans vous en occuper vous-même. On vous explique tout : le principe, la commission, les délais, et comment ça se passe concrètement chez Nouvelle Rive, au cœur du Marais.

## Le dépôt-vente, c'est quoi exactement ?

Dans un dépôt-vente, vous confiez vos pièces à une boutique qui se charge de les mettre en valeur, de les présenter et de les vendre pour vous. Point essentiel : vous restez propriétaire de l'article jusqu'à sa vente. Ce n'est qu'une fois la pièce vendue que vous êtes payé.e. Une commission est prélevée, le reste vous revient.

C'est ce qui distingue le dépôt-vente de deux autres options :

- Le rachat cash : on vous achète la pièce immédiatement, mais à un prix nettement plus bas. La personne qui rachète prend tout le risque, donc toute la marge.
- La vente entre particuliers (Vinted, Vestiaire Collective) : vous encaissez davantage sur le papier, mais vous gérez tout — annonce, questions, négociations, expédition, litiges, retours et risques d'arnaque.

Le dépôt-vente est l'entre-deux malin : un meilleur prix que le rachat cash, sans la charge mentale de la vente en solo.

## Ce que vous pouvez déposer

Les dépôts-ventes de luxe acceptent en général les sacs et la maroquinerie, le prêt-à-porter, les souliers, les accessoires et parfois les bijoux. Les maisons les plus recherchées (Hermès, Chanel, Louis Vuitton, Dior, Gucci, Céline…) partent évidemment plus vite, mais une belle pièce vintage sans logo, bien coupée et en bon état, trouve aussi son public.

Pour découvrir quelles pièces sont sélectionnées chez NOUVELLE RIVE, [voyez les pièces éligibles](/client/deposant/produits-acceptes).

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

Ce qui change tout : vous ne gérez ni les acheteuses et acheteurs, ni les questions, ni les négociations, ni les livraisons, ni les arnaques. Votre bien est mis en avant par une équipe qualifiée, dans un lieu premium, devant une vraie clientèle.

## Authentification et mise en valeur

Sur le luxe et les sacs de designer, le contrôle d'authenticité est rigoureux (cuir, coutures, quincaillerie, numéros et tampons, cohérence de l'ensemble). Si votre pièce de luxe est accompagnée d'un certificat d'origine, d'un dustbag ou de sa boîte d'origine, n'hésitez pas à les fournir : cela augmente sa valeur et ses chances de revente.

Une pièce bien présentée — nettoyée, photographiée avec soin, exposée dans un cadre premium — se vend mieux qu'une annonce faite à la va-vite depuis un canapé. C'est une grande partie de la valeur ajoutée du dépôt-vente.

## Commission, prix et paiement

Sur le marché du luxe, la commission d'un dépôt-vente se situe le plus souvent entre 30 et 50 %. Le prix de vente est fixé pour être juste : assez attractif pour partir, assez haut pour vous rémunérer correctement. Vous êtes payé.e après la vente.

Concrètement : plus une pièce est désirable et bien présentée, plus elle se vend vite — et une pièce qui se vend vite, c'est de l'argent qui rentre sans effort de votre côté.

Chez NOUVELLE RIVE, la commission oscille entre 30 et 40 % selon le mode de rémunération que vous choisissez. Pour plus de détails, [consultez nos conditions de dépôt](/client/deposant/conditions).

## Combien de temps pour vendre — et les invendus ?

Tout dépend de la pièce : une maison très recherchée dans une taille courante peut partir en quelques jours, une pièce plus pointue prend davantage de temps. Beaucoup de dépôts-ventes appliquent des baisses de prix programmées pour dynamiser les pièces qui tardent. Renseignez-vous toujours sur la politique concernant les invendus (retour, délai, don).

Chez NOUVELLE RIVE, nous gardons votre pièce deux mois. Si elle ne part pas le premier mois, nous appliquons une baisse de prix pour le deuxième.

> Le dépôt-vente, c'est offrir une seconde vie à une belle pièce sans effort — et faire de la place pour la suivante.

## Pourquoi passer par Nouvelle Rive

Nouvelle Rive est un lieu permanent au cœur du Marais, pensé pour mettre en avant le travail de créatrices et curateurices engagées sur le long terme. Vos pièces y sont vues en boutique comme en ligne, dans un esprit responsable et anti fast-fashion. Prêt à faire de la place — et à donner une seconde vie à vos plus belles pièces ?

Vous souhaitez vendre chez NOUVELLE RIVE ? [Découvrez nos conditions de dépôt](/client/deposant/conditions).`

const INCLUSIF = [
  ["auprès d'un professionnel qui contrôle chaque pièce", "auprès d'un·e professionnel·le qui contrôle chaque pièce"],
  ["auprès d'un professionnel reprend tout son sens", "auprès d'un·e professionnel·le reprend tout son sens"],
]

const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get()
const articles = snap.data().articles
for (const a of articles) {
  if (a.slug === 'depot-vente-luxe-paris') {
    a.body = DEPOT_BODY
    a.cta = { href: '/client/deposant/conditions', label: 'Voir les conditions de dépôt →' }
    console.log('✓ dépôt-vente : corps + CTA conditions')
  }
  if (a.body) for (const [o, n] of INCLUSIF) if (a.body.includes(o)) { a.body = a.body.split(o).join(n); console.log('✓ inclusif:', a.slug) }
}
await ref.set({ articles })
try { await getStorage().bucket().file('_cache/journal.json.gz').delete() } catch {}
console.log('done')
process.exit(0)
