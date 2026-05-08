// Écrit les champs accrocheEn / descriptionEn pour toutes les chineuses publiques.
// Idempotent : remplace toujours par la valeur fournie ci-dessous.
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, 'firebase-service-account.json'), 'utf8')
)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

// id Firestore → { accrocheEn, descriptionEn }
const TRANSLATIONS = {
  'adrenaline': {
    accrocheEn: 'Unique pieces from the 19th century & beyond',
    descriptionEn: "Adrénaline is a Parisian upcycled jewelry brand, born from the transformation of antique objects sourced through curated finds. Each creation is one of a kind — singular and carrying its own story — conceived as a contemporary talisman. The brand embraces a free, raw and poetic aesthetic.",
  },
  'aerea-studio': {
    accrocheEn: 'HYPNOTIC 3D-PRINTED CORN-BASED VASES',
    descriptionEn: 'Founded by Camille Lefer, an industrial designer, Aerea Studio explores the infinite possibilities of 3D technology to create mesmerizing, eco-conscious objects. All designs are conceptualized through 3D modeling, made via 3D printing, then hand-finished. The brand exclusively uses recycled or bio-based materials. Awarded the “Made in Paris” label.',
  },
  'age-paris': {
    accrocheEn: 'The ultimate suit',
    descriptionEn: 'Founded in 2021 by Eva and Mégane — two best friends — ÂGE Paris embodies the renewal of the textile industry at its finest. Their flagship piece, the iconic suit, is being reinvented: now upcycled from sourced finds or deadstock rolls from Luxury Houses. Collections are designed and produced in their Paris ateliers by tailors and seamstresses who have worked for houses such as Christian Dior or Emmanuelle Khanh. The name "ÂGE" evokes the timeless beauty and rich history of vintage clothing.',
  },
  'aime': {
    accrocheEn: 'PIECES YOU LOVE FOR A LIFETIME',
    descriptionEn: 'A selection of vintage pieces carefully curated by two best friends — fur coats, structured jackets, elegant skirts — for a timeless Parisian wardrobe. Pieces that tell a story and elevate every silhouette.',
  },
  'alisa-cayoo': {
    accrocheEn: 'MAXIMALIST UPCYCLING: MEMORIES TURNED INTO JEWELRY',
    descriptionEn: 'Alisa Cayoo is an experimental jewelry brand founded by Alisa, a multidisciplinary artist based in Paris. The name Cayoo [kaju] comes from the French "cailloux" — those small stones we keep preciously. As her frequent moves made it hard to part with sentimental objects, Alisa began transforming them into wearable pieces. Each creation is unique, handmade from chains, beads, buttons and vintage objects sourced around the world. Over 200 one-of-a-kind pieces to date, each telling a personal story.',
  },
  'anashi': {
    accrocheEn: 'SELECTED VINTAGE FOR ALL QUEENS',
    descriptionEn: "Anashi is a vintage selection carefully curated for every modern queen. Founded by Iosra, this Parisian brand offers unique pieces sourced with passion. Anashi celebrates timeless elegance and the authenticity of exceptional clothing with stories to tell.",
  },
  'archive-s': {
    accrocheEn: 'REGENERATED JEWELRY / OBJECTS MEANT TO BE KEPT',
    descriptionEn: 'Justine is the founder of archive.s, launched in 2020. Her pieces are made from recycled materials using the artisanal technique of Delft sand casting, which produces unique jewelry or small series, highlighting imperfections for a raw and authentic finish. Her aim is to celebrate the beauty of imperfection, impermanence and simplicity, valuing authenticity and the marks left by time.\n\narchives (n.f.): a body of documents and objects meant to be preserved; stock, records, collections. "The question of the archive is not a question of the past […] It is a question of the future, the very question of the future, the question of a response, of a promise, of a responsibility for tomorrow." Jacques Derrida, Trace archive, image et art, p. 129',
  },
  'bonage': {
    accrocheEn: 'SECOND-HAND AND VINTAGE KIDSWEAR',
    descriptionEn: 'BonÂge offers a selection of unique kidswear pieces with quality fabrics, timeless cuts and in perfect condition. Among the favorite brands: Bonpoint, Dior, Burberry, Bobo Choses, Bonton, Chloé, Tartine et Chocolat… Because our little ones unfortunately don\'t grow into their clothes, Sophie Actis, founder of Bonâge, created her brand for her own children — and ours.',
  },
  'brillante': {
    accrocheEn: 'LIGHT IT UP: THE ACTIVIST LIGHTER',
    descriptionEn: "Brillante is an accessories brand created by Ambre Desard whose pieces blend bold femininity, queer singularity and assumed political claims. With these lighter cases, Brillante carries a message against oppressions everywhere you go. Recycled TPU.",
  },
  'brujas': {
    accrocheEn: 'TWO WITCH SISTERS',
    descriptionEn: 'Brujas draws its inspiration from a mystical and artistic universe. The brand offers vintage and upcycled treasures that tell stories, blending bohemian influences with contemporary touches. Each piece invites you to assert your singularity with daring and poetry.',
  },
  'cameleon': {
    accrocheEn: 'MASCULINE LUXURY, ETHICALLY SOURCED',
    descriptionEn: 'Caméléon is the vintage destination for the man who refuses to compromise on style or ethics. A sharp selection of menswear luxury pieces — from the most prestigious houses to rare finds — sourced with an expert eye. For a wardrobe where every piece carries a story and timeless value.',
  },
  'chineuz2bling': {
    accrocheEn: 'Wow Jewelry',
    descriptionEn: 'Alex aka Chineuz has been a treasure hunter since childhood. She joined the National Institute of Gemmology 10 years ago, where she trained in jewelry expertise, notably within auction houses. Once she earned her gemmology degree, she worked for 3 years with a diamond dealer before becoming passionate about vintage jewelry. She now offers exclusive pieces from the 60s to the 90s.\nThe selected jewelry was crafted in France or Italy and comes from the dormant stocks of period jewelers. She loves favorite pieces — bold and confident, witnesses to a past quality that endures.\nWishing today to express her own vision of jewelry, she also reuses certain pieces to create new ones, between powerful ornament and sustainable approach.',
  },
  'collection-equine': {
    accrocheEn: 'FROM THE SALOON TO THE SALONS',
    descriptionEn: 'A horsewoman since the age of 3, the founder of Collection Équine has a boundless love for the equestrian world. The brand draws its inspiration from it, offering carefully selected vintage pieces that blend countryside romance, Parisian refinement and equestrian boldness. From Western to Old Money, every piece tells a story — between authenticity and confident femininity.',
  },
  'cozines': {
    accrocheEn: 'ASSUMED VINTAGE FOR WOMEN WHO DARE',
    descriptionEn: 'Cozinès is a premium vintage brand founded by Inès, a former singer passionate about rare pieces. The selection brings together high-end second-hand clothing and accessories.\nLeather, suede, silk, unconventional cuts, designer pieces, and treasures from old labels.\nThe artistic direction embodies a committed, self-assured woman, who dresses for herself.\nEach piece is chosen for its character, quality and assertive style.\nCozinès is unique, bold, durable vintage.\nFor women who dare.',
  },
  'dark-vintage': {
    accrocheEn: 'MOTO INSPIRED: THE FASTEST SLOW FASHION',
    descriptionEn: "Inspired by the world of motorcycles, Dark Vintage offers a sharp curation of high-end vintage clothing. Leather jackets, denim, rare pieces by Chanel, Courrèges, Jean Paul Gaultier or Supreme — a selection for fashion lovers seeking exceptional pieces with strong character.",
  },
  'diabolo-menthe': {
    accrocheEn: 'THE FRESHHH VINTAGE COCKTAIL',
    descriptionEn: 'Diabolo Menthe is a cocktail of colorful, sparkling pieces, originality and unique finds — all served fresh. The Diabolo Menthe universe celebrates offbeat style and sartorial daring, for those who love to stand out with one-of-a-kind pieces full of history.',
  },
  'digger-club': {
    accrocheEn: 'HANDPICKED VINTAGE FROM MARSEILLE',
    // pas de description FR — on n'écrit rien pour descriptionEn
  },
  'digger-sister': {
    accrocheEn: 'BOLD UPCYCLED PIECES',
    descriptionEn: 'Born from a passion for upcycling, Digger Sister revives dormant clothing and fabrics by transforming them into unique, precious and singular pieces. The brand reinterprets the classics of the feminine wardrobe. It turns shirts, blazers and pencil skirts into bold, contemporary pieces. Every creation is designed with care and patience in her Paris atelier.\n\nFor Nejma, the founder, it\'s the sensitive alignment between a vision of style and values that are essential to her. The brand builds a more sustainable, human and original fashion.',
  },
  'frusques': {
    accrocheEn: 'TREASURE ALERT: FLEA MARKET GEMS IN THE HEART OF PARIS',
    descriptionEn: 'Solidly established at Marché Dauphine, Frusques is making an escape to rue des Ecouffes. Frusques is the art of sourcing pieces that make a difference. This urban vintage selection offers accessories and clothing with strong character, between Y2K aesthetic and indie sleaze influences. Original bags, offbeat silhouettes: Frusques dresses those who want to stand out with style and authenticity.',
  },
  'l3hKaVwDdXfhDDcC56DLcusmfq23': {
    // GIGI PARIS — pas d'accroche/description en FR pour l'instant, on saute
  },
  'ines-pineau': {
    accrocheEn: 'JEWELRY: THE SHARPEST UPCYCLING IN PARIS',
    descriptionEn: 'Inès Pineau launched her eponymous brand in early 2017 alongside her studies at Atelier Chardon Savard. A seasoned vintage hunter, she quickly adopted upcycling and transformation as her creative process. Each piece is unique, made from luxury salvage — clasps, leather goods hardware — and semi-precious stones. Her gender-neutral creations are made in limited editions, mainly in 24k fine-gold-plated brass and stainless steel.',
  },
  'maison-beguin': {
    accrocheEn: 'ICONIC VINTAGE AT THE RIGHT PRICE',
    descriptionEn: 'Founded by Laura Seror, Maison Béguin is a Parisian concept store mixing décor with vintage and modern wardrobes. For NOUVELLE RIVE, Laura sources character-driven vintage pieces one by one. Maison Béguin Dressing makes sustainable fashion accessible.',
  },
  'maison-mascarello': {
    accrocheEn: 'UPCYCLED BAGS AND ONE-OF-A-KIND DESIGNS',
    descriptionEn: "A new name on Marseille's creative scene, Maison Mascarello designs unique bags from locally sourced materials — notably leather offcuts and end-of-stock from regional artisans and La Réserve des Arts Sud.\nConceived as hybrid objects between design and craftsmanship, Maison Mascarello bags stand out through their rounded lines and singular details.",
  },
  'maki-corp': {
    accrocheEn: 'AN EYE ON THE FUTURE: REFURBISHED VINTAGE EYEWEAR',
    descriptionEn: 'Maki Corp brings exceptional vintage eyewear back to life. Specialized in refurbishing iconic frames — Cartier, and other luxury houses — the brand combines artisanal know-how with a passion for vintage. Every pair goes through a meticulous restoration atelier. A bridge between Paris and Tana for eyewear that crosses eras with style.',
  },
  'mazette': {
    accrocheEn: 'VINTAGE GIRLS CLUB',
    descriptionEn: 'Mazette Vintage Club is a sharp selection of vintage pieces from the 90s and 2000s, chosen for their character.\nEach garment is curated with care to offer a fashion-forward, instinctive and singular silhouette.',
  },
  'mission-vintage': {
    accrocheEn: 'YOUR MISSION, SHOULD YOU CHOOSE TO ACCEPT IT, IS VINTAGE',
    descriptionEn: 'Founded by Ben & Olivia, Mission Vintage has been offering carefully selected second-hand clothing for over 2 years. A wardrobe that blends vintage designer pieces (Margiela, Prada, CDG, Jean Paul Gaultier) with contemporary style.',
  },
  'muse-rebelle': {
    accrocheEn: 'PARISIAN CHIC: REGENERATED VINTAGE-STYLE EARRINGS',
    descriptionEn: 'Founded in December 2023 by Yev Topyer, stylist and content creator, Muse Rebelle embodies timeless elegance and Parisian chic with a vintage twist. The brand offers a Maison collection of statement earrings with retro inspiration, designed in Paris. Inspired by icons such as Lady Diana and Audrey Hepburn, Muse Rebelle celebrates confident, elegant and authentic women. The brand notably collaborated with French fashion house Tara Jarmon to create the "Rebelle" earrings. Recycled brass.',
  },
  'nan-goldies': {
    accrocheEn: 'Nineties are gold',
    descriptionEn: "Nan Goldies offers a sharp selection of vintage pieces, carefully sourced one by one straight from the 90s. It's giving worked cuts, rare prints, plays of textures and French manufacturing — to put together a look as unique as it is poetic.",
  },
  'nouvelle-rive': {
    accrocheEn: 'OUR OWN COLLECTION',
    descriptionEn: 'NOUVELLE RIVE has its own pieces too!',
  },
  'okalis': {
    accrocheEn: 'MARSEILLE-MADE CREATIONS IN RECYCLED SILVER',
    // pas de description FR — on n'écrit rien
  },
  'pardon-pardon': {
    accrocheEn: 'PARDON, PARDON, COMING THROUGH',
    descriptionEn: 'After braving the wind and the crowds to roam every flea market in Paris, Léa now only says "pardon, pardon" (excuse me). It became the brand\'s mantra — she moves faster than anyone to dig out the most fire pieces from Parisians\' wardrobes. That insane piece you were looking for everywhere? You couldn\'t find it because Léa already nabbed it. Pardon!',
  },
  'personal-seller': {
    accrocheEn: 'WHERE LUXURY FINDS ITS SECOND HOME',
    descriptionEn: 'Founded in 2019 by Jeanne Dana and Léa Levy, Personal Seller Paris is the pioneer of personal selling in France. A turnkey service for individuals looking to clear out their wardrobe: pickup, inventory, photography, storage, sale negotiation, shipping and payments. The brand specializes in pre-loved luxury pieces.',
  },
  'prestanx': {
    accrocheEn: 'FLASHY 3D-PRINTED HANDBAG',
    descriptionEn: "Catching every eye is now easy. Prestanx reimagines leather goods — without leather, with a lot of audacity. Zero animal materials, plenty of style.\n3D printed from recycled filaments.",
  },
  'pristini': {
    accrocheEn: 'CURATED DESIGNER ARCHIVES ✦ VINTAGE GEMS',
    descriptionEn: 'Pristini Paris hunts down the finest designer archive pieces and vintage gems. Hailed by Vogue France among the 15 best vintage stores in Paris, Pristini offers a sharp curation for fashion lovers in search of rare and desirable pieces.',
  },
  'rashhiiid': {
    accrocheEn: 'HANDMADE FAUX FUR – BOLD & EXPRESSIVE',
    descriptionEn: 'Created by Rachel Maguire, a 27-year-old Irish designer based in Paris, Rashhiiid offers expressive, offbeat and bold handmade pieces. "I want my creations to allow whoever wears them to say something without speaking." Specialized in hats, coats and accessories in luxury faux fur, every piece is handmade with vegan, cruelty-free materials, lined with recycled polyester. Her creations have caught the eye of superstars like Doja Cat and Megan Thee Stallion. Statement pieces with evocative names like "Grand Dollar Bill", "Tower of Fantasy" or "Rainbow Racoon" — for those who want to turn every outing into a fashion moment.',
  },
  'sergio-tacchineur': {
    accrocheEn: 'TEASING STYLE: VINTAGE & STREETWEAR FOR MEN',
    descriptionEn: 'Coming straight from Marché Vernaison at the Saint-Ouen flea market, Sergio Tacchineur is making a stop on rue des Ecouffes. Sergio Tacchineur is a selection of vintage, high-end and rare pieces, sourced one by one at auctions, flea markets, from individuals or while traveling. We love mixing and diversity — whether in cultures, fashion, styles or generations.',
  },
  'soir': {
    accrocheEn: 'ARCHIVE AND PRE-LOVED DESIGNER CLOTHING',
    descriptionEn: 'Soir Vintage is a boutique specialized in archive pieces and pre-loved designer clothing. The selection includes iconic pieces from major houses: Saint Laurent by Hedi Slimane, Roberto Cavalli, Mugler, Tom Ford… Each garment tells a story of fashion and gives access to collectible pieces that are often impossible to find.',
  },
  'strass-chronique': {
    accrocheEn: 'ICONIC BAGS HANDMADE IN MARSEILLE',
    descriptionEn: "Strass Chronique is a slow fashion brand based in Marseille. Small editions and one-of-a-kind pieces only. Every piece is handcrafted in Marseille. strasschronique — bold upcycled creations — tartan bubble skirts, lace tops, corset shirts — that blend textile salvage with artisanal know-how. For those looking for eco-conscious statement pieces, handmade with love in the Phocaean city.",
  },
  'tete-dorange': {
    accrocheEn: 'JEWELRY: PURE, MINIMALIST UPCYCLING',
    descriptionEn: "Tête d'Orange is a Strasbourg-based brand of upcycled, handmade jewelry crafted from quality materials. The brand brings vintage and second-hand jewelry back to life through an eco-conscious approach. The unique pieces are gold-plated, gold-filled or silver, adorned with semi-precious stones and freshwater pearls. Worn by personalities such as Fanny Sidney, Eva Danino and Flore Benguigui, these pieces combine style with environmental awareness.",
  },
  'the-parisian-vintage': {
    accrocheEn: 'CURATED VINTAGE & DESIGNER ARCHIVES',
    descriptionEn: "The Parisian Vintage is a luxury vintage brand specialized in curating vintage pieces and designer archives. The brand drops new finds every month, carefully selected. The Parisian Vintage was born from a meeting: that of Jules and Alexandra. Their family has now joined the adventure. Fashion lovers, vintage hunters and Parisians at heart, they showcase vintage pieces in a style that is at once Parisian and unique. A must-visit spot for fashion lovers seeking unique and authentic pieces.",
  },
  'upznshit': {
    accrocheEn: '{upz and shit}',
    // pas de description FR — on n'écrit rien
  },
}

let written = 0
let skipped = 0
const errors = []

for (const [docId, fields] of Object.entries(TRANSLATIONS)) {
  const update = {}
  if (fields.accrocheEn !== undefined) update.accrocheEn = fields.accrocheEn
  if (fields.descriptionEn !== undefined) update.descriptionEn = fields.descriptionEn
  if (Object.keys(update).length === 0) { skipped++; continue }
  try {
    await db.collection('chineuse').doc(docId).update(update)
    written++
    console.log(`✓ ${docId}`)
  } catch (e) {
    errors.push({ docId, msg: e.message })
    console.error(`✗ ${docId}: ${e.message}`)
  }
}

console.log('─'.repeat(60))
console.log(`OK: ${written}  |  Skipped: ${skipped}  |  Errors: ${errors.length}`)
if (errors.length) console.log(JSON.stringify(errors, null, 2))
