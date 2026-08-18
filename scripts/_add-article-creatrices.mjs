// Ajoute l'article "Pourquoi on soutient les jeunes créatrices" au doc Firestore (sans reseed).
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
const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get()
const articles = snap.data().articles
const slug = 'pourquoi-soutenir-jeunes-creatrices'

const body = `Chez Nouvelle Rive, on met un point d'honneur à faire une place aux jeunes créatrices et curateurices. Pas par charité — parce qu'on y gagne toutes. Voici, sans détour, pourquoi soutenir la jeune création, c'est le meilleur choix que tu puisses faire pour ta garde-robe (et pour ta conscience).

## Parce que c'est plus beau et plus unique

Une jeune créatrice ne dessine pas pour plaire à tout le monde : elle dessine ce qu'elle aime, avec ses mains, ses idées, son univers. Résultat, des pièces qui ont une âme, une allure, un vrai parti pris — à des années-lumière des collections calibrées et sans surprise. Tu portes quelque chose que personne d'autre n'a. Le contraire de l'uniforme.

## Parce que c'est souvent beaucoup moins cher que tu ne crois

On imagine la création jeune inaccessible : c'est faux. Sans marketing à rallonge ni intermédiaires à chaque étage, une pièce de créatrice émergente coûte souvent bien moins qu'un vêtement de marque au logo bien placé — pour une qualité et une originalité incomparables. Tu paies le talent et la matière, pas la pub.

## Parce que tu pourras dire « moi, je l'avais repérée avant »

Soyons honnêtes : il y a un vrai plaisir à flairer le talent avant tout le monde. Le jour où ta créatrice perce, tu pourras dire « MOI, je l'avais repérée en 2012 » — avec la pièce pour le prouver. Soutenir la jeune création, c'est se constituer une garde-robe de pionnière.

## Parce que tu aides quelqu'un à vivre son rêve

Derrière chaque pièce, il y a une personne qui a tout misé sur sa passion. Quand tu achètes, tu ne remplis pas les caisses d'un actionnaire : tu permets à une créatrice de payer son loyer, ses matières, et de continuer à créer. On te le garantit : à chaque vente, il y a une petite danse de la victoire quelque part. Ton achat, c'est un vrai coup de pouce, pas une goutte d'eau dans un océan.

## Parce qu'il n'y a pas d'usine qui empoisonne les fleuves

La jeune création, c'est de la petite série, du fait main, du local, de l'upcyclé. Pas d'usine géante qui déverse des teintures toxiques dans les rivières qui nous font vivre, pas de production massive à l'autre bout du monde. Acheter une pièce de créatrice, c'est un geste doux pour la planète autant que pour ton style.

## Parce que c'est être belle dehors ET dedans

Au fond, c'est ça le vrai luxe : porter une pièce magnifique en sachant exactement d'où elle vient, qui l'a faite, et ce qu'elle a permis. Être belle à l'extérieur et à l'intérieur — et pouvoir le raconter. Une tenue qui te va bien, c'est agréable ; une tenue qui te va bien et qui a du sens, c'est irrésistible.

> Soutenir une jeune créatrice, ce n'est pas un sacrifice. C'est le plus beau des privilèges.

## Chez Nouvelle Rive, on leur donne un espace

C'est toute notre raison d'être : offrir aux créatrices et curateurices engagées un lieu permanent, au cœur du Marais, pour mettre leur travail en lumière et rencontrer leur public. Chaque portant est le leur. En chinant ici, tu ne fais pas qu'acheter une pièce — tu écris un petit bout de leur histoire.`

const article = {
  slug,
  title: 'Pourquoi on soutient les jeunes créatrices',
  description:
    "Plus beau, plus unique, souvent moins cher, plus juste : pourquoi soutenir les jeunes créatrices est le meilleur choix pour ta garde-robe et la planète.",
  category: 'MANIFESTE',
  date: '2026-08-26',
  readingMinutes: 5,
  cover: '/facade%20paysage.jpg',
  body,
  relu: false,
  published: false,
  cta: { href: '/nos-creatrices', label: 'Découvrir nos créatrices →' },
}

const i = articles.findIndex(a => a.slug === slug)
if (i === -1) { articles.unshift(article); console.log('✓ article créé') }
else { articles[i] = { ...articles[i], ...article }; console.log('· article mis à jour') }

await ref.set({ articles })
try { await getStorage().bucket().file('_cache/journal.json.gz').delete(); console.log('✓ blob vidé') } catch {}
console.log(`mots: ${body.split(/\\s+/).length} · total articles: ${articles.length}`)
process.exit(0)
