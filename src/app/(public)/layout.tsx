// src/app/(public)/layout.tsx
import NavbarPublic from '@/components/NavbarPublic'
import BackstageTracker from '@/components/BackstageTracker'
import MetaPixel from '@/components/MetaPixel'
import ConsentBanner from '@/components/ConsentBanner'

const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ClothingStore',
  '@id': 'https://www.nouvellerive.eu/#store',
  name: 'NOUVELLE RIVE',
  alternateName: 'NOUVELLE RIVE Paris',
  description:
    "Boutique vintage et upcyclée au cœur du Marais à Paris. Pièces uniques chinées par des créatrices indépendantes — vintage de luxe, upcycling, créateurs.",
  url: 'https://www.nouvellerive.eu',
  image: 'https://www.nouvellerive.eu/facade%20paysage.jpg',
  logo: 'https://www.nouvellerive.eu/icon-512.png',
  email: 'nouvelleriveparis@gmail.com',
  priceRange: '€€',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '8 rue des Ecouffes',
    addressLocality: 'Paris',
    postalCode: '75004',
    addressRegion: 'Île-de-France',
    addressCountry: 'FR',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 48.857105,
    longitude: 2.358547,
  },
  hasMap: 'https://www.google.com/maps?cid=13450927928425031822',
  sameAs: [
    'https://www.instagram.com/nouvellerive/',
    'https://www.tiktok.com/@nouvelle.rive',
    'https://www.google.com/maps?cid=13450927928425031822',
  ],
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Monday', opens: '11:00', closes: '20:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Tuesday', opens: '12:00', closes: '20:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Wednesday', opens: '12:00', closes: '20:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Thursday', opens: '12:00', closes: '20:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Friday', opens: '11:00', closes: '20:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '11:00', closes: '20:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Sunday', opens: '11:00', closes: '20:00' },
  ],
  areaServed: { '@type': 'City', name: 'Paris' },
  paymentAccepted: 'Carte bancaire, Apple Pay, Google Pay',
  currenciesAccepted: 'EUR',
}

// Note affichée dans le schema = vraie note Google (jamais en dur).
// Récupérée via l'API Places, mise en cache 1h. Sans clé ou sans donnée réelle,
// on n'émet AUCUN aggregateRating (Google sanctionne les notes inventées).
async function getGoogleRating(): Promise<{ ratingValue: number; reviewCount: number } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.rating,places.userRatingCount',
      },
      body: JSON.stringify({
        textQuery: 'Nouvelle Rive 8 rue des Écouffes 75004 Paris',
        languageCode: 'fr',
        regionCode: 'FR',
      }),
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const data = await res.json()
    const place = data.places?.[0]
    const ratingValue = place?.rating
    const reviewCount = place?.userRatingCount
    if (!ratingValue || !reviewCount) return null
    return { ratingValue, reviewCount }
  } catch {
    return null
  }
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://www.nouvellerive.eu/#website',
  url: 'https://www.nouvellerive.eu',
  name: 'NOUVELLE RIVE',
  description: 'Boutique vintage et upcyclée au cœur du Marais à Paris.',
  inLanguage: 'fr-FR',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://www.nouvellerive.eu/boutique?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const rating = await getGoogleRating()
  const storeJsonLd = rating
    ? {
        ...localBusinessJsonLd,
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: String(rating.ratingValue),
          reviewCount: String(rating.reviewCount),
          bestRating: '5',
          worstRating: '1',
        },
      }
    : localBusinessJsonLd

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <BackstageTracker />
      <MetaPixel />
      <NavbarPublic />
      {children}
      <ConsentBanner />
    </>
  )
}
