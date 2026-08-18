// src/app/(public)/en/journal/page.tsx — English Journal index
import Link from 'next/link'
import type { Metadata } from 'next'
import { getLiveEnglishArticles } from '@/lib/journal-store'

export const revalidate = 3600

const bleu = '#0000FF'
const BASE_URL = 'https://www.nouvellerive.eu'

export const metadata: Metadata = {
  title: 'Journal — vintage, luxury consignment & circular fashion | NOUVELLE RIVE',
  description:
    "The NOUVELLE RIVE Journal: guides on vintage, luxury consignment in Paris, upcycling and responsible fashion. Tips to thrift and buy well.",
  alternates: {
    canonical: `${BASE_URL}/en/journal`,
    languages: { 'fr-FR': `${BASE_URL}/journal`, 'en-US': `${BASE_URL}/en/journal`, 'x-default': `${BASE_URL}/journal` },
  },
}

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function EnJournalPage() {
  const articles = await getLiveEnglishArticles()

  return (
    <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <main className="min-h-screen bg-white">
        <div className="px-6 py-20">
          <h1
            id="titre"
            style={{ fontSize: 'clamp(40px, 8vw, 120px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 0.9, textTransform: 'uppercase' }}
          >
            Journal
          </h1>
        </div>

        <div className="w-full border-t border-black" />

        {articles.length === 0 ? (
          <div className="max-w-3xl mx-auto px-6 py-24 text-center">
            <p style={{ fontSize: '18px', color: '#666' }}>Our first articles are coming very soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10 px-6 py-12">
            {articles.map(a => (
              <Link key={a.slug} href={`/en/journal/${a.slug}`} className="group block">
                {a.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.cover} alt={a.titleEn || a.title} className="w-full block" style={{ aspectRatio: '3 / 4', objectFit: 'cover' }} />
                ) : (
                  <div className="w-full bg-gray-100 flex items-center justify-center text-gray-300" style={{ aspectRatio: '3 / 4', fontSize: 40 }}>✦</div>
                )}
                <p className="mt-3 uppercase font-semibold" style={{ fontSize: '10px', letterSpacing: '0.15em', color: bleu }}>
                  {a.categoryEn || a.category}
                </p>
                <h2 className="mt-1 group-hover:underline" style={{ fontSize: '17px', fontWeight: 700, lineHeight: 1.2 }}>
                  {a.titleEn}
                </h2>
                <p className="mt-1" style={{ fontSize: '12px', letterSpacing: '0.03em', color: '#999' }}>
                  {formatDate(a.date)} · {a.readingMinutes} min read
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-black py-8 text-center">
        <p style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#999' }}>NOUVELLE RIVE — 8 RUE DES ECOUFFES, PARIS</p>
      </footer>
    </div>
  )
}
