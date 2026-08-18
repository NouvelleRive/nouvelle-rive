// src/app/(public)/journal/page.tsx — index du Journal (server component)
import Link from 'next/link'
import { getLiveArticles } from '@/lib/journal-store'

export const revalidate = 3600

const bleu = '#0000FF'

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function JournalPage() {
  const articles = await getLiveArticles()

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
        {/* Titre — même format que les autres pages */}
        <div className="px-6 py-20">
          <h1
            id="titre"
            style={{
              fontSize: 'clamp(40px, 8vw, 120px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 0.9,
              textTransform: 'uppercase',
            }}
          >
            Journal
          </h1>
        </div>

        <div className="w-full border-t border-black" />

        {articles.length === 0 ? (
          <div className="max-w-3xl mx-auto px-6 py-24 text-center">
            <p style={{ fontSize: '18px', color: '#666' }}>
              Nos premiers articles arrivent très bientôt.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10 px-6 py-12">
            {articles.map(a => (
              <Link key={a.slug} href={`/journal/${a.slug}`} className="group block">
                {a.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.cover}
                    alt={a.title}
                    className="w-full block"
                    style={{ aspectRatio: '3 / 4', objectFit: 'cover' }}
                  />
                ) : (
                  <div className="w-full bg-gray-100 flex items-center justify-center text-gray-300" style={{ aspectRatio: '3 / 4', fontSize: 40 }}>
                    ✦
                  </div>
                )}
                <p className="mt-3 uppercase font-semibold" style={{ fontSize: '10px', letterSpacing: '0.15em', color: bleu }}>
                  {a.category}
                </p>
                <h2 className="mt-1 group-hover:underline" style={{ fontSize: '17px', fontWeight: 700, lineHeight: 1.2 }}>
                  {a.title}
                </h2>
                <p className="mt-1" style={{ fontSize: '12px', letterSpacing: '0.03em', color: '#999' }}>
                  {formatDate(a.date)} · {a.readingMinutes} min
                </p>
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
