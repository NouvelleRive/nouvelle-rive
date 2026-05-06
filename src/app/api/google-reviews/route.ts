import { NextResponse } from 'next/server'

// Cache 1h côté Vercel
export const revalidate = 3600

const PLACE_QUERY = 'Nouvelle Rive 8 rue des Écouffes 75004 Paris'

export async function GET() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY manquante' }, { status: 500 })
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
