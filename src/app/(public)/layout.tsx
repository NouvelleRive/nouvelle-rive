// src/app/(public)/layout.tsx
import NavbarPublic from '@/components/NavbarPublic'

const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ClothingStore',
  '@id': 'https://www.nouvellerive.eu/#store',
  name: 'Nouvelle Rive',
  alternateName: 'Nouvelle Rive Paris',
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

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://www.nouvellerive.eu/#website',
  url: 'https://www.nouvellerive.eu',
  name: 'Nouvelle Rive',
  description: 'Boutique vintage et upcyclée au cœur du Marais à Paris.',
  inLanguage: 'fr-FR',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://www.nouvellerive.eu/boutique?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <NavbarPublic />
      {children}
    </>
  )
}
