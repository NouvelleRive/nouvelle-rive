import { NextResponse } from 'next/server'

export const revalidate = 3600

const PLACE_QUERY = 'Nouvelle Rive 8 rue des Écouffes 75004 Paris'

const MOCK_REVIEWS_FR = [
  {
    author: 'Camille D.',
    authorPhoto: null,
    rating: 5,
    text: "Une pépite dans le Marais. Sélection vintage incroyable, accueil au top, on repart toujours avec une trouvaille. La devanture bleu Klein est sublime.",
    relativeTime: 'il y a 2 semaines',
  },
  {
    author: 'Léa M.',
    authorPhoto: null,
    rating: 5,
    text: "Boutique magnifique, des pièces uniques et l'équipe est adorable. Mes meilleures trouvailles vintage de Paris ! Je recommande à 1000%.",
    relativeTime: 'il y a 1 mois',
  },
  {
    author: 'Sophie R.',
    authorPhoto: null,
    rating: 5,
    text: "Adresse coup de cœur. Le concept féministe + la sélection pointue + le quartier = magique. Bravo à toute l'équipe.",
    relativeTime: 'il y a 1 mois',
  },
  {
    author: 'Margaux T.',
    authorPhoto: null,
    rating: 5,
    text: "Vintage curated avec goût, prix raisonnables, ambiance chaleureuse. Le 3W reborn version mode, c'est oui.",
    relativeTime: 'il y a 2 mois',
  },
  {
    author: 'Inès P.',
    authorPhoto: null,
    rating: 4,
    text: "Très belle boutique, sélection soignée. J'ai trouvé une veste Mugler qui me suit partout depuis. Rien à redire.",
    relativeTime: 'il y a 3 mois',
  },
]

const MOCK_REVIEWS_EN = [
  {
    author: 'Camille D.',
    authorPhoto: null,
    rating: 5,
    text: "A gem in Le Marais. Incredible vintage selection, lovely welcome — you always leave with a find. The Klein blue storefront is gorgeous.",
    relativeTime: '2 weeks ago',
  },
  {
    author: 'Léa M.',
    authorPhoto: null,
    rating: 5,
    text: "Beautiful boutique, unique pieces and the team is so kind. My best vintage finds in Paris! 1000% recommend.",
    relativeTime: 'a month ago',
  },
  {
    author: 'Sophie R.',
    authorPhoto: null,
    rating: 5,
    text: "An absolute favorite. Feminist concept + sharp curation + the neighborhood = magic. Hats off to the whole team.",
    relativeTime: 'a month ago',
  },
  {
    author: 'Margaux T.',
    authorPhoto: null,
    rating: 5,
    text: "Tastefully curated vintage, fair prices, warm vibe. The 3W reborn as a fashion space — yes please.",
    relativeTime: '2 months ago',
  },
  {
    author: 'Inès P.',
    authorPhoto: null,
    rating: 4,
    text: "Beautiful boutique, careful selection. Found a Mugler jacket that's been with me ever since. Nothing to complain about.",
    relativeTime: '3 months ago',
  },
]

function buildMock(lang: 'fr' | 'en') {
  return {
    name: 'Nouvelle Rive',
    rating: 4.9,
    total: 47,
    mapsUri: 'https://www.google.com/maps/place/NOUVELLE+RIVE',
    reviews: lang === 'en' ? MOCK_REVIEWS_EN : MOCK_REVIEWS_FR,
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'fr'
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json(buildMock(lang))
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.reviews',
      },
      body: JSON.stringify({
        textQuery: PLACE_QUERY,
        languageCode: lang === 'en' ? 'en' : 'fr',
        regionCode: lang === 'en' ? 'US' : 'FR',
      }),
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json({ error: `Places API ${res.status}: ${txt}` }, { status: 502 })
    }

    const data = await res.json()
    const place = data.places?.[0]
    if (!place) {
      return NextResponse.json({ error: lang === 'en' ? 'Place not found' : 'Lieu introuvable' }, { status: 404 })
    }

    const reviews = (place.reviews || []).map((r: { authorAttribution?: { displayName?: string; photoUri?: string }; rating?: number; text?: { text?: string }; originalText?: { text?: string }; relativePublishTimeDescription?: string; publishTime?: string }) => ({
      author: r.authorAttribution?.displayName || (lang === 'en' ? 'Anonymous' : 'Anonyme'),
      authorPhoto: r.authorAttribution?.photoUri || null,
      rating: r.rating || 0,
      text: r.text?.text || r.originalText?.text || '',
      relativeTime: r.relativePublishTimeDescription || '',
      publishTime: r.publishTime || null,
    }))

    return NextResponse.json({
      name: place.displayName?.text || 'Nouvelle Rive',
      rating: place.rating || 0,
      total: place.userRatingCount || 0,
      mapsUri: place.googleMapsUri || null,
      reviews,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
