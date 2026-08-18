// src/app/(public)/journal/[slug]/page.tsx — page article (server component)
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ARTICLES, getArticleBySlug, type ArticleBlock } from '@/lib/journal-articles'

export const revalidate = 3600

const bleu = '#0000FF'
const BASE_URL = 'https://www.nouvellerive.eu'

export function generateStaticParams() {
  return ARTICLES.map(a => ({ slug: a.slug }))
}

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) return { title: 'Article introuvable — NOUVELLE RIVE' }

  const url = `${BASE_URL}/journal/${article.slug}`
  return {
    title: `${article.title} | NOUVELLE RIVE`,
    description: article.description,
    alternates: { canonical: url },
    // Brouillon = non indexé tant que published:false.
    robots: article.published ? undefined : { index: false, follow: false },
    openGraph: {
      title: article.title,
      description: article.description,
      url,
      type: 'article',
      siteName: 'NOUVELLE RIVE',
      publishedTime: article.date,
      images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: article.title }],
      locale: 'fr_FR',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
      images: ['/facade%20paysage.jpg'],
    },
  }
}

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case 'h2':
      return (
        <h2 className="mt-12 mb-4" style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1.2 }}>
          {block.text}
        </h2>
      )
    case 'p':
      return (
        <p className="mb-5" style={{ fontSize: '17px', lineHeight: 1.7, color: '#222' }}>
          {block.text}
        </p>
      )
    case 'ul':
      return (
        <ul className="mb-5 space-y-2" style={{ listStyle: 'disc', paddingLeft: '1.2em' }}>
          {block.items.map((it, i) => (
            <li key={i} style={{ fontSize: '17px', lineHeight: 1.6, color: '#222' }}>
              {it}
            </li>
          ))}
        </ul>
      )
    case 'quote':
      return (
        <blockquote
          className="my-8 pl-6"
          style={{ borderLeft: `3px solid ${bleu}`, fontSize: '20px', fontStyle: 'italic', lineHeight: 1.5, color: bleu }}
        >
          {block.text}
        </blockquote>
      )
  }
}

export default async function ArticlePage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) notFound()

  const url = `${BASE_URL}/journal/${article.slug}`

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': url,
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    dateModified: article.date,
    inLanguage: 'fr-FR',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Organization', name: 'NOUVELLE RIVE', url: BASE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'NOUVELLE RIVE',
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/icon-512.png` },
    },
    image: `${BASE_URL}/facade%20paysage.jpg`,
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Journal', item: `${BASE_URL}/journal` },
      { '@type': 'ListItem', position: 3, name: article.title, item: url },
    ],
  }

  return (
    <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="min-h-screen bg-white">
        {!article.published && (
          <div
            className="text-center py-2 px-4 uppercase"
            style={{ background: bleu, color: '#fff', fontSize: '11px', letterSpacing: '0.15em', fontWeight: 600 }}
          >
            Brouillon — non publié, non indexé
          </div>
        )}

        <article className="max-w-3xl mx-auto px-6 py-16">
          <Link
            href="/journal"
            className="uppercase"
            style={{ fontSize: '11px', letterSpacing: '0.15em', color: bleu, fontWeight: 600 }}
          >
            ← Journal
          </Link>

          <p
            className="mt-8 uppercase font-semibold"
            style={{ fontSize: '11px', letterSpacing: '0.15em', color: bleu }}
          >
            {article.category}
          </p>

          <h1
            id="titre"
            className="mt-4"
            style={{ fontSize: 'clamp(30px, 5vw, 46px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.01em' }}
          >
            {article.title}
          </h1>

          <p className="mt-4" style={{ fontSize: '13px', letterSpacing: '0.05em', color: '#999' }}>
            {formatDate(article.date)} · {article.readingMinutes} min de lecture
          </p>

          <div className="w-full border-t border-black mt-8 mb-10" />

          {article.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}

          {article.cta && (
            <div className="mt-12">
              <Link
                href={article.cta.href}
                className="inline-block py-4 px-8 text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: bleu, fontSize: '11px', letterSpacing: '0.2em', fontWeight: 600 }}
              >
                {article.cta.label}
              </Link>
            </div>
          )}
        </article>
      </main>

      <footer className="border-t border-black py-8 text-center">
        <p style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#999' }}>
          NOUVELLE RIVE — 8 RUE DES ECOUFFES, PARIS
        </p>
      </footer>
    </div>
  )
}
