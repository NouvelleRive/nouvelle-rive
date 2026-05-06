import { NextResponse } from 'next/server'

// Cache 1h côté Vercel
export const revalidate = 3600

const PLACE_QUERY = 'Nouvelle Rive 8 rue des Écouffes 75004 Paris'

const MOCK_DATA = {
  preview: true,
  name: 'Nouvelle Rive',
  rating: 4.9,
  total: 47,
  mapsUri: 'https://www.google.com/maps/place/NOUVELLE+RIVE',
  reviews: [
    {
      author: 'Camille D.',
      authorPhoto: null,
      rating: 5,
      text: "Une pépite dans le Marais. Sélection vintage incroyable, accueil au top, on repart toujours avec une trouvaille. La devanture bleu Klein est sublime.",
      relativeTime: 'il y a 2 semaines',
      reply: { text: "Merci infiniment Camille ! Hâte de te revoir bientôt 💙", relativeTime: 'il y a 2 semaines' },
    },
    {
      author: 'Léa M.',
      authorPhoto: null,
      rating: 5,
      text: "Boutique magnifique, des pièces uniques et l'équipe est adorable. Mes meilleures trouvailles vintage de Paris ! Je recommande à 1000%.",
      relativeTime: 'il y a 1 mois',
      reply: { text: "Léa merci pour ces mots, ça nous touche beaucoup. À très vite chez Nouvelle Rive !", relativeTime: 'il y a 4 semaines' },
    },
    {
      author: 'Sophie R.',
      authorPhoto: null,
      rating: 5,
      text: "Adresse coup de cœur. Le concept féministe + la sélection pointue + le quartier = magique. Bravo à toute l'équipe.",
      relativeTime: 'il y a 1 mois',
      reply: { text: "Sophie, ton retour nous fait chaud au cœur. C'est tout le sens du projet, merci d'en faire partie.", relativeTime: 'il y a 1 mois' },
    },
    {
      author: 'Margaux T.',
      authorPhoto: null,
      rating: 5,
      text: "Vintage curated avec goût, prix raisonnables, ambiance chaleureuse. Le 3W reborn version mode, c'est oui.",
      relativeTime: 'il y a 2 mois',
      reply: null,
    },
    {
      author: 'Inès P.',
      authorPhoto: null,
      rating: 4,
      text: "Très belle boutique, sélection soignée. J'ai trouvé une veste Mugler qui me suit partout depuis. Rien à redire.",
      relativeTime: 'il y a 3 mois',
      reply: { text: "Merci Inès ! Cette veste Mugler avait une histoire, on est heureuses qu'elle soit chez toi maintenant.", relativeTime: 'il y a 3 mois' },
    },
  ],
}

export async function GET() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json(MOCK_DATA)
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.reviews',
      },
      body: JSON.stringify({ textQuery: PLACE_QUERY, languageCode: 'fr', regionCode: 'FR' }),
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json({ error: `Places API ${res.status}: ${txt}` }, { status: 502 })
    }

    const data = await res.json()
    const place = data.places?.[0]
    if (!place) {
      return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 })
    }

    const reviews = (place.reviews || []).map((r: any) => ({
      author: r.authorAttribution?.displayName || 'Anonyme',
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
