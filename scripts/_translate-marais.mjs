import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const g=(q)=>`https://www.google.com/maps/search/${encodeURIComponent(q)}`
const bodyEn = `Le Marais is THE vintage district of Paris, and it offers a unique and diverse shopping experience: vintage thrift shops, trendy boutiques, designer stores and art galleries sit side by side. While retaining its historical charm, the Marais is seen today as a fashion-forward haven, attracting style-conscious and discerning shoppers alike. Each corner has its own vibe: on one side the historic Marais, lively and cobbled; on the other the Haut Marais, with its concept stores and galleries. Here's a real tour, area by area — where to hunt, where to have lunch, and where to grab the best coffee.

## The Marais thrift map

::map vintage Le Marais Paris

## Area 1 — The historic Marais (around rue des Rosiers)

It's a unique place where eras overlap.

A Jewish quarter in the Middle Ages, then an aristocratic district in the 16th and 17th centuries — you still find traces everywhere: religious folk stroll along rue des Rosiers, right by one of the oldest synagogues in Paris; you'll find some of the best Ashkenazi and Sephardic restaurants in the city; and private mansions (hôtels particuliers) hide behind carriage doors. The Marais holds many secrets about Paris's past — that's surely why designers and artisans have made it their favourite district today.

It's also one of the city's great gay districts, renowned for its inclusivity: its visible LGBTQ+-friendly character has made it a safe place for the community, fostering an atmosphere of warmth, diversity, style and celebration. The historic Marais is full of small clubs and bars, and it feels like everybody can truly be themselves and at home: religious folk, girls and gays, fashionistas, art lovers and party-goers — this whole little world lives together and enriches one another. It is also the only district in Paris to have kept its narrow, occasionally crooked streets and buildings from the pre-revolutionary era, escaping Baron Haussmann's great transformation of 1853. The streets tell all of it: rue des Écouffes, where we are, was "the street of clothes" and the former street of girls; a stone's throw away, rue des Mauvais Garçons (the street of the bad boys). Cobblestones, a village feel, and a real density of thrift-by-the-kilo shops, consignment stores and designer vintage. The Marais never fails to surprise.

Our starting point is NOUVELLE RIVE, at 8 rue des Écouffes. The place has a history: it was the first lesbian club in the Marais, Le 3W (Women with Women). You can still see the smoking room downstairs — and the checkout sits on the old DJ booth. Today, each rail is run by a different designer, from pieces under €20 to luxury vintage.

**For lunch**: the legendary falafel at [L'As du Fallafel](${g("L'As du Fallafel rue des Rosiers Paris")}) on rue des Rosiers, a more arty break at the café of the [Fondation Azzedine Alaïa](${g("Fondation Azzedine Alaia Paris")}), or a lovely table at [Chez Anna](${g("Chez Anna restaurant Marais Paris")}).

**For coffee or matcha (and a great photo)**: [Pasa Dena](${g("Pasa Dena Paris")}) and [Joho](${g("Joho cafe Paris Marais")}), our favourite spots around here.

## Area 2 — The Haut Marais (Turenne, Charlot, Bretagne)

The vibe: concept stores, art galleries, designer archives and luxury vintage. A more recent Marais, turned towards fashion and design, where you browse without digging.

**For lunch**: head to the [Marché des Enfants Rouges](${g("Marché des Enfants Rouges Paris")}), the oldest covered market in Paris: it dates back to 1615 and takes its name from a former orphanage whose children wore red. Its little food stalls from around the world (Moroccan, Italian, Japanese…) make it the perfect spot to grab a bite between two shops.

**For coffee or matcha**: [Merlot](${g("Merlot cafe Haut Marais Paris")}), the go-to spot in the Haut Marais.

## Don't miss

Beyond the shops, the Marais is worth looking up for:
- [Place des Vosges](${g("Place des Vosges Paris")}): the oldest royal square in Paris, its arcades and garden — perfect for a break.
- [Rue des Rosiers](${g("Rue des Rosiers Paris")}): the beating heart of the Jewish quarter, between falafels, delis and vintage.
- The [Musée Carnavalet](${g("Musée Carnavalet Paris")}): the whole history of Paris, in two Marais mansions (permanent collections free).
- The [Hôtel de Ville](${g("Hotel de Ville Paris")}): the monumental façade and its square, at the gates of the Marais.

## Smart tips for the tour

- Come early in the week or in the morning: the selection is fresh and less picked-over.
- Ask about deliveries: some places (ours included) refresh their pieces several times a day.
- Always try things on: vintage cuts fit differently from today's.
- For luxury, check authenticity — or buy somewhere that guarantees it.

## Finish where you started

After your loop, swing back by NOUVELLE RIVE: new pieces may have arrived in the meantime. That's the magic of the Marais — the selection changes all the time.

> The Marais isn't for visiting, it's for hunting.`

const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  a.titleEn='The ideal thrift tour of Le Marais'
  a.descriptionEn='A walking tour to hunt vintage in Le Marais: history, areas, thrift shops, where to have lunch and the best coffee, from NOUVELLE RIVE.'
  a.categoryEn='LE MARAIS'
  a.bodyEn=bodyEn
  console.log('OK EN Marais rempli,', bodyEn.split(/\s+/).length, 'mots')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
