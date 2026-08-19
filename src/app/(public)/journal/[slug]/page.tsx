// src/app/(public)/journal/[slug]/page.tsx — page article (server component)
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { parseBody, SEED_ARTICLES, type ArticleBlock } from '@/lib/journal-articles'
import { getStoredArticle, isArticleLive, hasEnglish } from '@/lib/journal-store'
import ArticleSlider from '@/components/ArticleSlider'

export const revalidate = 3600

const bleu = '#0000FF'
const BASE_URL = 'https://www.nouvellerive.eu'

export function generateStaticParams() {
  return SEED_ARTICLES.map(a => ({ slug: a.slug }))
}

function formatDate(iso: string) {
  if (!iso) return ''
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
  const article = await getStoredArticle(slug)
  if (!article) return { title: 'Article introuvable — NOUVELLE RIVE' }

  const url = `${BASE_URL}/journal/${article.slug}`
  const live = isArticleLive(article)
  const languages = hasEnglish(article)
    ? { 'fr-FR': url, 'en-US': `${BASE_URL}/en/journal/${article.slug}`, 'x-default': url }
    : undefined
  return {
    title: `${article.title} | NOUVELLE RIVE`,
    description: article.description,
    alternates: { canonical: url, languages },
    // Tant qu'il n'est pas réellement en ligne (relu + publié + date atteinte) : non indexé.
    robots: live ? undefined : { index: false, follow: false },
    openGraph: {
      title: article.title,
      description: article.description,
      url,
      type: 'article',
      siteName: 'NOUVELLE RIVE',
      publishedTime: article.date,
      images: [{ url: article.cover || '/facade%20paysage.jpg', width: 1200, height: 630, alt: article.title }],
      locale: 'fr_FR',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
      images: [article.cover || '/facade%20paysage.jpg'],
    },
  }
}

// Rend les liens markdown [texte](url) cliquables dans le texte courant.
function renderInline(text: string): React.ReactNode {
  const re = /\[([^\]]+)\]\(([^)]+)\)/g
  const out: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const href = m[2]
    const ext = href.startsWith('http')
    out.push(
      <a
        key={key++}
        href={href}
        {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        style={{ color: bleu, textDecoration: 'underline', textUnderlineOffset: '2px' }}
      >
        {m[1]}
      </a>,
    )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out.length ? out : text
}

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case 'h2':
      return (
        <h2 className="mt-12 mb-4" style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1.2 }}>
          {renderInline(block.text)}
        </h2>
      )
    case 'p':
      return (
        <p className="mb-5" style={{ fontSize: '17px', lineHeight: 1.7, color: '#222' }}>
          {renderInline(block.text)}
        </p>
      )
    case 'ul':
      return (
        <ul className="mb-5 space-y-2" style={{ listStyle: 'disc', paddingLeft: '1.2em' }}>
          {block.items.map((it, i) => (
            <li key={i} style={{ fontSize: '17px', lineHeight: 1.6, color: '#222' }}>
              {renderInline(it)}
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
          {renderInline(block.text)}
        </blockquote>
      )
    case 'img':
      return (
        <figure className="my-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.src} alt={block.alt} className="w-full block" style={{ borderRadius: 2 }} loading="lazy" />
          {block.alt && (
            <figcaption className="mt-2 text-center" style={{ fontSize: '12px', color: '#999' }}>{block.alt}</figcaption>
          )}
        </figure>
      )
    case 'video':
      return (
        <figure className="my-8 flex flex-col items-center">
          <video
            src={block.src}
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="metadata"
            className="block"
            style={{ maxWidth: 340, width: '100%', borderRadius: 4, aspectRatio: '9 / 16', objectFit: 'cover' }}
          />
          {block.alt && (
            <figcaption className="mt-2 text-center" style={{ fontSize: '12px', color: '#999' }}>{block.alt}</figcaption>
          )}
        </figure>
      )
    case 'videorow':
      return (
        <div
          className="my-8 grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(block.videos.length, 3)}, 1fr)` }}
        >
          {block.videos.map((v, i) => (
            <figure key={i} className="flex flex-col">
              <video src={v.src} autoPlay muted loop playsInline preload="metadata" className="block w-full"
                style={{ borderRadius: 4, aspectRatio: '9 / 16', objectFit: 'cover' }} />
              {v.alt && <figcaption className="mt-1.5 text-center" style={{ fontSize: '11px', color: '#999' }}>{v.alt}</figcaption>}
            </figure>
          ))}
        </div>
      )
    case 'slider':
      return <ArticleSlider images={block.images} />
  }
}

export default async function ArticlePage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const article = await getStoredArticle(slug)
  if (!article) notFound()

  const url = `${BASE_URL}/journal/${article.slug}`
  const live = isArticleLive(article)
  const today = new Date().toISOString().slice(0, 10)
  const status = live
    ? null
    : !article.relu
      ? 'Brouillon — à relire, non indexé'
      : !article.published
        ? 'Relu — pas encore publié, non indexé'
        : `Programmé le ${formatDate(article.date)} — non indexé avant`

  const blocks = parseBody(article.body)

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
    image: article.cover
      ? (article.cover.startsWith('http') ? article.cover : `${BASE_URL}${article.cover}`)
      : `${BASE_URL}/facade%20paysage.jpg`,
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
        {status && (
          <div
            className="text-center py-2 px-4 uppercase"
            style={{ background: bleu, color: '#fff', fontSize: '11px', letterSpacing: '0.12em', fontWeight: 600 }}
          >
            {status}
          </div>
        )}

        {article.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.cover} alt={article.title} className="w-full block" style={{ height: '78vh', maxHeight: 820, objectFit: 'cover', objectPosition: 'center top' }} />
        )}

        <article className="max-w-3xl mx-auto px-6 py-16">
          <Link
            href="/journal"
            className="uppercase"
            style={{ fontSize: '11px', letterSpacing: '0.15em', color: bleu, fontWeight: 600 }}
          >
            ← Journal
          </Link>

          <p className="mt-8 uppercase font-semibold" style={{ fontSize: '11px', letterSpacing: '0.15em', color: bleu }}>
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
            {article.date ? `${formatDate(article.date)} · ` : ''}{article.readingMinutes} min de lecture
          </p>

          <div className="w-full border-t border-black mt-8 mb-10" />

          {blocks.map((block, i) => (
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

          {article.sources && article.sources.length > 0 && (
            <div className="mt-16 pt-8 border-t border-gray-200">
              <p className="uppercase font-semibold" style={{ fontSize: '11px', letterSpacing: '0.15em', color: '#999' }}>
                Sources
              </p>
              <ul className="mt-3 space-y-1">
                {article.sources.map((s, i) => (
                  <li key={i} style={{ fontSize: '12px', lineHeight: 1.5 }}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: '#999', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
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
