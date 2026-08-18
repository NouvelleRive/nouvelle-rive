// Traduit le dépôt-vente en anglais + passe "Nouvelle Rive" -> "NOUVELLE RIVE" partout.
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

const bodyEn = `A bag, a coat or a pair of designer shoes gathering dust in your closet? Consignment is the easiest way to give it a second life — and turn it into cash — without lifting a finger. Here's how it works: the principle, the commission, the timelines, and exactly how it goes at Nouvelle Rive, in the heart of Le Marais.

## What is consignment, exactly?

With consignment, you entrust your pieces to a boutique that showcases, presents and sells them for you. Key point: you remain the owner of the item until it sells. Only once the piece is sold is a commission taken — the rest is yours.

That's what sets consignment apart from two other options:

- Cash buyout: you're paid immediately, but at a much lower price. Whoever buys it to resell takes all the risk, so all the margin.
- Peer-to-peer selling (Vinted, Vestiaire Collective): you pocket more on paper, but you handle everything — the listing, the questions, the haggling, shipping, disputes, returns and scam risks.

Consignment is the smart middle ground: a better price than a cash buyout, without the mental load of selling on your own.

## What you can consign

Luxury consignment stores generally accept bags and leather goods, ready-to-wear, shoes, accessories and sometimes jewelry. The most sought-after houses (Hermès, Chanel, Louis Vuitton, Dior, Gucci, Céline…) obviously sell faster, but a beautiful vintage piece with no logo, well cut and in good condition, also finds its audience.

To see which pieces we select at NOUVELLE RIVE, [check the eligible pieces](/client/deposant/produits-acceptes).

## The conditions to be accepted

Three criteria matter everywhere:

- Authenticity: essential, especially for luxury. A piece whose authenticity can't be established won't go on sale.
- Condition: we only keep pieces in good to very good condition. An exception can be made for a real favorite — the price is then adjusted accordingly.
- Desirability: model, cut, material, seasonality. A sought-after piece sells faster and higher.

## Step by step, at Nouvelle Rive

1. You create your seller account on the site via "Sell at Nouvelle Rive", then submit your pieces (photos + description).
2. We review your proposal and validate the pieces that fit the selection.
3. Once accepted, your piece is authenticated, styled and photographed by our team.
4. It joins the physical boutique, at 8 rue des Écouffes, and our online shop — with worldwide shipping.
5. You track everything from your account.

What changes everything: you don't deal with buyers, questions, negotiations, deliveries or scams. Your item is showcased by a qualified team, in a premium space, in front of a real clientele.

## Authentication and presentation

For luxury and designer bags, the authenticity check is thorough (leather, stitching, hardware, serial numbers and stamps, overall consistency). If your luxury piece comes with a certificate of origin, a dustbag or its original box, feel free to include them: it increases its value and its chances of resale.

A well-presented piece — cleaned, carefully photographed, displayed in a premium setting — sells better than a listing thrown together from a couch. That's a big part of the added value of consignment.

## Commission, price and payment

On the luxury market, a consignment commission usually sits between 30 and 50%. The selling price is set to be fair: attractive enough to sell, high enough to pay you properly. You're paid after the sale.

In short: the more desirable and well-presented a piece is, the faster it sells — and a piece that sells fast is money coming in effortlessly on your side.

At NOUVELLE RIVE, the commission ranges from 30 to 40% depending on the payout option you choose. For all the details, [read our consignment terms](/client/deposant/conditions).

## How long does it take to sell — and unsold pieces?

It depends on the piece: a very sought-after house in a common size can sell within days; a more niche piece takes longer. Many consignment stores apply scheduled markdowns to boost pieces that linger. Always check the policy on unsold items (return, timeline, donation).

At NOUVELLE RIVE, we keep your piece for two months. If it doesn't sell in the first month, we apply a price drop for the second.

> Consignment means giving a beautiful piece a second life effortlessly — and making room for the next one.

## Why choose Nouvelle Rive

Nouvelle Rive is a permanent space in the heart of Le Marais, built to spotlight the work of committed designers and curators over the long term. Your pieces are seen both in store and online, in a responsible, anti fast-fashion spirit. Ready to make some room — and give your finest pieces a second life?

Want to sell at NOUVELLE RIVE? [Discover our consignment terms](/client/deposant/conditions).`

// Dates de publication : une par jour à partir du 19/08 (dépôt-vente déjà publié le 18).
const DATES = {
  'reconnaitre-vrai-sac-luxe-vintage': '2026-08-19',
  'vintage-upcycle-regenere-difference': '2026-08-20',
  'chiner-vintage-marais': '2026-08-21',
  'vintage-luxe-petit-prix': '2026-08-22',
  'vintage-plutot-que-fast-fashion': '2026-08-23',
  'pourquoi-detester-fast-fashion': '2026-08-24',
  'pourquoi-soutenir-jeunes-creatrices': '2026-08-25',
}

const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get()
const articles = snap.data().articles
for (const a of articles) {
  if (a.slug === 'depot-vente-luxe-paris') {
    a.titleEn = 'Luxury consignment in Paris: how it works'
    a.descriptionEn = 'Luxury consignment in Paris: how it works, commission, timelines and payment. How to consign and sell your pieces at Nouvelle Rive.'
    a.categoryEn = 'GUIDE'
    a.bodyEn = bodyEn
  }
  // "Nouvelle Rive" -> "NOUVELLE RIVE" dans les champs texte EXISTANTS uniquement
  for (const key of ['title', 'description', 'body', 'titleEn', 'descriptionEn', 'bodyEn']) {
    if (typeof a[key] === 'string') a[key] = a[key].split('Nouvelle Rive').join('NOUVELLE RIVE')
  }
  // dates une par jour
  if (DATES[a.slug]) a.date = DATES[a.slug]
}

await ref.set({ articles })
try { await getStorage().bucket().file('_cache/journal.json.gz').delete() } catch {}
console.log('✓ EN dépôt-vente + majuscules NOUVELLE RIVE + dates 1/jour')
console.log('  dates:', Object.entries(DATES).map(([s, d]) => `${d} ${s.slice(0,18)}`).join(' | '))
process.exit(0)
