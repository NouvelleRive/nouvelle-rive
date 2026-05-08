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

const TRANSLATIONS = {
  'trench-burberry': {
    nomEn: 'Burberry Trenches',
    pourquoiMustEn: 'The timeless must-have — a vintage Burberry trench gains 8% in value each year',
    histoireEn: "Invented by Thomas Burberry in 1879, the trench coat was born to dress British officers during the First World War. Its waterproof gabardine, patented in 1888, made it the secret weapon of the trenches — hence the name. A civilian icon since the 1930s, it dressed Audrey Hepburn in Breakfast at Tiffany's and Humphrey Bogart in Casablanca.",
  },
  'timeless-chanel': {
    nomEn: 'Chanel Bags',
    pourquoiMustEn: 'Its value has doubled in 10 years — a more profitable investment than the S&P 500',
    histoireEn: "The 2.55, created by Coco Chanel in February 1955 (hence the name), is the first luxury shoulder bag — a revolution at a time when women still carried their bags in hand. Its quilting echoes the jackets of Longchamp jockeys; its chain, the belts of the orphanage caretakers from Coco's youth. The 11.12, later popularized by Karl Lagerfeld with the double C, becomes the house's other pillar.",
  },
  'levis-501': {
    nomEn: "Levi's Jeans",
    pourquoiMustEn: "Vintage 60s Big E models go for four-figure prices in Japan",
    histoireEn: "Levi Strauss and Jacob Davis patented denim trousers reinforced with copper rivets in 1873, designed for the California gold prospectors. The 501, the flagship model with its straight cut and button fly, has crossed decades without a wrinkle: worn by James Dean, Marilyn Monroe, Bruce Springsteen. Today, a vintage 50s–60s 501 (Big E, redline selvedge) can fetch several thousand euros from Japanese collectors.",
  },
  'blazer-luxe-80s': {
    nomEn: '80s Luxury Blazers',
    pourquoiMustEn: 'The power dressing spirit, in a vintage piece from a luxury house',
    histoireEn: "The 80s turned the blazer into a weapon of power. Yves Saint Laurent with his smoking, Giorgio Armani with his sculpted shoulders and fluid fabrics, Thierry Mugler with his nipped waists — all redrew the feminine silhouette for the boardrooms. The power suit became the manifesto of an entire generation of working girls. Forty years later, these vintage pieces signed YSL, Mugler or Versace are the most coveted in vintage stores.",
  },
  'escarpins-cuir': {
    nomEn: 'Leather Pumps',
    pourquoiMustEn: 'The timeless elegance that transforms any silhouette',
    histoireEn: "Marilyn Monroe immortalized them in 1955 in The Seven Year Itch: the white dress and the pumps. But the pump as we know it was born earlier, with Roger Vivier creating the first stiletto heel for Christian Dior in 1953. A tool of elegance, a weapon of seduction, the leather pump remains the ally of every silhouette — Carrie Bradshaw made her Manolo Blahniks her fetish in Sex and the City.",
  },
  'boucles-80s-dorees': {
    nomEn: 'Statement Earrings',
    pourquoiMustEn: 'The accessory that changes everything — chosen by our upcycling designers',
    histoireEn: "The 80s were the golden age of XXL earrings: oversized hoops, geometric clips, oversized pearls. A piece that transforms a look in an instant, and that Parisian designers like Gigi Paris and Chineuse de Bling reinterpret today through their upcycled lens.",
  },
  'fourrure-vintage': {
    nomEn: 'Vintage Furs',
    pourquoiMustEn: 'Old Hollywood glamour, without new animal impact',
    histoireEn: "Before the 90s and growing animal-rights awareness, fur was the ultimate symbol of luxury and glamour: Grace Kelly, Liz Taylor, Ava Gardner — all wore it. Today, the only ethical way to own one is second-hand: these vintage pieces, already in existence, generate no further animal impact. Recycling what already exists is the very essence of circular fashion.",
  },
  // baguette-fendi, lunettes-chanel, revenge-dress : encore en lorem ipsum, on ne traduit pas
}

let written = 0
const errors = []

for (const [docId, fields] of Object.entries(TRANSLATIONS)) {
  try {
    await db.collection('iconiques').doc(docId).update(fields)
    written++
    console.log(`✓ ${docId}`)
  } catch (e) {
    errors.push({ docId, msg: e.message })
    console.error(`✗ ${docId}: ${e.message}`)
  }
}

console.log('─'.repeat(60))
console.log(`OK: ${written}  |  Errors: ${errors.length}`)
if (errors.length) console.log(JSON.stringify(errors, null, 2))
