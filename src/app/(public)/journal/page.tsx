// src/app/(public)/journal/page.tsx — index du Journal (server component)
import Link from 'next/link'
import { getPublishedArticles } from '@/lib/journal-articles'

export const revalidate = 3600

const bleu = '#0000FF'

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function JournalPage() {
  const articles = getPublishedArticles()

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': 'https://www.nouvellerive.eu/journal',
    name: 'Journal NOUVELLE RIVE',
    description:
      "Guides sur le vintage, le dépôt-vente de luxe, l'upcycling et la mode responsable, depuis le Marais à Paris.",
    url: 'https://www.nouvellerive.eu/journal',
    blogPost: articles.map(a => ({
      '@type': 'BlogPosting',
      headline: a.title,
      url: `https://www.nouvellerive.eu/journal/${a.slug}`,
      datePublished: a.date,
      description: a.description,
    })),
  }

  return (
    <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <main className="min-h-screen bg-white">
        {/* Hero */}
        <div className="px-6 py-20">
          <h1
            id="titre"
            style={{
              fontFamily: 'Didot, "Bodoni MT", serif',
              fontSize: 'clamp(48px, 9vw, 130px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: '0.9',
              color: bleu,
            }}
          >
            Journal
          </h1>
          <p
            className="mt-6 uppercase font-semibold"
            style={{ fontSize: 'clamp(11px, 1.2vw, 13px)', letterSpacing: '0.04em', maxWidth: 620 }}
          >
            Vintage, dépôt-vente & mode circulaire — nos guides depuis le Marais.
          </p>
        </div>

        <div className="w-full border-t border-black" />

        {articles.length === 0 ? (
          <div className="max-w-3xl mx-auto px-6 py-24 text-center">
            <p style={{ fontSize: '18px', color: '#666' }}>
              Nos premiers articles arrivent très bientôt.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((a, i) => (
              <Link
                key={a.slug}
                href={`/journal/${a.slug}`}
                className="group block border-b border-black p-8 md:p-10 transition-colors hover:bg-gray-50 md:border-r"
                style={{
                  borderRightWidth: (i + 1) % 3 === 0 ? 0 : undefined,
                }}
              >
                <p
                  className="uppercase font-semibold"
                  style={{ fontSize: '11px', letterSpacing: '0.15em', color: bleu }}
                >
                  {a.category}
                </p>
                <h2
                  className="mt-4"
                  style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1.15 }}
                >
                  {a.title}
                </h2>
                <p className="mt-4" style={{ fontSize: '15px', lineHeight: 1.6, color: '#444' }}>
                  {a.description}
                </p>
                <p className="mt-6" style={{ fontSize: '12px', letterSpacing: '0.05em', color: '#999' }}>
                  {formatDate(a.date)} · {a.readingMinutes} min de lecture
                </p>
                <span
                  className="inline-block mt-4 group-hover:translate-x-1 transition-transform"
                  style={{ fontSize: '14px', fontWeight: 600, color: bleu }}
                >
                  Lire →
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-black py-8 text-center">
        <p style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#999' }}>
          NOUVELLE RIVE — 8 RUE DES ECOUFFES, PARIS
        </p>
      </footer>
    </div>
  )
}
