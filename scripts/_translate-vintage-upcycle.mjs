import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const V='https://nouvellerive.b-cdn.net/videos/'
const bodyEn = `Vintage, secondhand, thrift, upcycled, regenerated, retro… These words are everywhere in responsible fashion, and they're often confused or misused. Here's what they really mean, so you know exactly what you're buying — and buy better.

## Vintage: the 20-year rule

A piece is called vintage when it has genuine period value — usually more than twenty years old — and is representative of the style or craftsmanship of its era. Under 20 years, we talk about retro or simply secondhand; beyond 100 years, we enter the realm of antiques. Vintage isn't just "old": it's a piece that has stood the test of time and keeps, or even gains, value. An 80s tailored suit, a Y2K piece from the early 2000s or an iconic House bag are good examples.

Where does the word come from? People often say it comes from the French "vingt-age" (twenty years of age): a nice story, but a myth — and a debated one. In reality, "vintage" comes from the world of wine — from the Old French "vendange" (the grape harvest, from the Latin vindemia). It first referred to the year of a fine wine, then, by the late 19th century (around 1883), to anything "from a bygone era". It was only in the 20th century that it was applied to clothing and collectibles.

## Secondhand: the big family

Secondhand refers to any already-worn garment that finds a new owner, whatever its age. It's the broadest category. Remember the inclusion rule: all vintage is secondhand, but not all secondhand is vintage. A pair of jeans bought last year and resold today is secondhand — not vintage.

## Vintage vs thrift: not the same thing

The two are often confused. A thrift store, strictly speaking, is a place that moves large volumes of secondhand clothes in bulk, often recent and of all brands (including fast fashion), sometimes sold by the kilo. Vintage, on the other hand, is a selection of dated pieces chosen for their quality or interest. You can hunt for vintage in a thrift store, but a thrift store isn't synonymous with vintage.

## Vintage vs retro: age versus style

Retro is new clothing that imitates the aesthetic of the past (a dress made today "in a 50s style"). It's a matter of style, not age. Vintage actually has the age it shows. A piece can be neo-retro without a single day of history.

## Upcycled: transform rather than throw away

Upcycling means transforming an existing piece or material into a new, often unique, creation. A shirt becomes a dress, fabric offcuts become a bag. You "upgrade" the material instead of throwing it away. There are two main types.
- Post-production upcycling starts from new, never-used materials — notably deadstock (offcuts and unsold factory stock): it can sometimes generate very small runs.
- Post-consumption upcycling starts from a piece that has already been worn: it most often leads to one-of-a-kind pieces (but not always!).
In both cases, it's creation in its own right, with real added value. Upcycling is a genuine challenge for the designers who specialise in it, because it's not just about creating, but re-creating. They don't start from a blank page, and yet they have to build a coherent brand identity. Hats off to them!!

![Inès Pineau — upcycling](${V}DSF3XLMDEds-fs-1778414142867.mp4)
![Digger Sister — upcycling](${V}DVl6SB7goux-fs-1778414097221.mp4)
![Tête d'Orange — upcycling](${V}DGQaHDws64M-fs-1778414306737.mp4)

## Upcycled vs regenerated: the key nuance

This is THE most common confusion. Upcycling preserves the garment or fabric and transforms it as is. Regeneration, on the other hand, destroys the material before bringing it back to life. Fabric, for example, is shredded, frayed and re-spun into a new fibre. Metal is melted down, plastic is ground up, and so on. Upcycling keeps the story of the piece; regeneration starts from scratch. And globally, only a tiny percentage of textiles is actually recycled into new clothes — hence the value of extending what already exists. Like upcycling, regeneration is a real craft: you have to master the material to bring it back to life without wasting it.

![Okalis — regeneration](${V}DOsXgb2iGlm-fs-1779289990707.mp4)
![Okalis — regeneration](${V}DWHTANOiLIk-fs-1779290003538.mp4)

## In terms of ecological impact

A product's ecological impact is measured across its whole life cycle, from creation to end of life. It runs through several stages: resource extraction => processing => sale => end of life. Each of these stages consumes and pollutes (raw materials, energy, waste). If you buy a new product, the materials may be extracted from the four corners of the world, shipped to China to be assembled, sent back to France to be sold, then shipped to Africa to be burned, or end up in a landfill in Asia. The pollution from transport alone is enormous — new raw materials were extracted to make it, and in the end it becomes waste.

> Everything we've bought in our lives still exists somewhere on the planet. Just because we no longer see it doesn't mean it's gone.

All the consumption options mentioned in this article (vintage, upcycling, regenerated) are better than new.
- Secondhand — vintage, thrift — is the most ecological of all: no transformation, only transport.
- Then comes upcycling. By using materials that already exist, there's no extraction of new material, and a piece of waste disappears!
- The same goes for regenerated, which is nonetheless a little more energy-hungry, since the material has to be shredded or melted down.

## What all these words have in common

> Keep clothes in circulation, and out of the bin.

Vintage, secondhand, upcycled, regenerated: these are four ways to make material last rather than fuel overproduction.

## At NOUVELLE RIVE: the three together

At NOUVELLE RIVE, you'll find these families together — vintage, upcycled and regenerated — all cruelty free and designed to protect our beautiful planet and its inhabitants, animals included. Each space is run by a different designer, with her own world and her own price range, from pieces under €20 to luxury vintage. It's up to you to find the one that's you.`

const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
const regroup=(b)=>{let p;do{p=b;b=b.replace(/(\.mp4\))\n\n(!\[[^\]]*\]\([^)]+\.mp4\))/g,'$1\n$2')}while(b!==p);return b}
for(const a of articles) if(a.slug==='vintage-upcycle-regenere-difference'){
  a.titleEn='Vintage, upcycled, regenerated: what\\'s the difference?'
  a.descriptionEn='Vintage, secondhand, thrift, upcycled, regenerated: all the circular-fashion definitions and how to choose well.'
  a.categoryEn='CIRCULAR FASHION'
  a.bodyEn=bodyEn
  a.body=regroup(a.body)   // re-groupe aussi les vidéos FR en rangées
  console.log('✓ EN rempli ('+bodyEn.split(/\s+/).length+' mots), vidéos FR re-groupées')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
