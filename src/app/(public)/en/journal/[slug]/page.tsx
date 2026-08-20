// src/app/(public)/en/journal/[slug]/page.tsx — English article page
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { parseBody, type ArticleBlock } from '@/lib/journal-articles'
import { getStoredArticle, isArticleLive, hasEnglish } from '@/lib/journal-store'
import ArticleSlider from '@/components/ArticleSlider'
import ArticleMap from '@/components/ArticleMap'

export const revalidate = 3600

const bleu = '#0000FF'
const BASE_URL = 'https://www.nouvellerive.eu'

function formatDate(iso: string) {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const article = await getStoredArticle(slug)
  if (!article || !hasEnglish(article)) return { title: 'Article not found — NOUVELLE RIVE' }

  const enUrl = `${BASE_URL}/en/journal/${article.slug}`
  const frUrl = `${BASE_URL}/journal/${article.slug}`
  const live = isArticleLive(article)
  return {
    title: `${article.titleEn} | NOUVELLE RIVE`,
    description: article.descriptionEn || '',
    alternates: {
      canonical: enUrl,
      languages: { 'fr-FR': frUrl, 'en-US': enUrl, 'x-default': frUrl },
    },
    robots: live ? undefined : { index: false, follow: false },
    openGraph: {
      title: article.titleEn,
      description: article.descriptionEn || '',
      url: enUrl,
      type: 'article',
      siteName: 'NOUVELLE RIVE',
      publishedTime: article.date,
      images: [{ url: article.cover || '/facade%20paysage.jpg', width: 1200, height: 630, alt: article.titleEn || '' }],
      locale: 'en_US',
    },
  }
}

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
      <a key={key++} href={href} {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})} style={{ color: bleu, textDecoration: 'underline', textUnderlineOffset: '2px' }}>
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
      return <h2 className="mt-12 mb-4" style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1.2 }}>{renderInline(block.text)}</h2>
    case 'p':
      return <p className="mb-5" style={{ fontSize: '17px', lineHeight: 1.7, color: '#222' }}>{renderInline(block.text)}</p>
    case 'ul':
      return (
        <ul className="mb-5 space-y-2" style={{ listStyle: 'disc', paddingLeft: '1.2em' }}>
          {block.items.map((it, i) => <li key={i} style={{ fontSize: '17px', lineHeight: 1.6, color: '#222' }}>{renderInline(it)}</li>)}
        </ul>
      )
    case 'quote':
      return (
        <blockquote className="my-8 pl-6" style={{ borderLeft: `3px solid ${bleu}`, fontSize: '20px', fontStyle: 'italic', lineHeight: 1.5, color: bleu }}>
          {renderInline(block.text)}
        </blockquote>
      )
    case 'img':
      return (
        <figure className="my-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.src} alt={block.alt} className="w-full block" style={{ borderRadius: 2 }} loading="lazy" />
          {block.alt && <figcaption className="mt-2 text-center" style={{ fontSize: '12px', color: '#999' }}>{block.alt}</figcaption>}
        </figure>
      )
    case 'video':
      return (
        <figure className="my-8 flex flex-col items-center">
          <video src={block.src} autoPlay muted loop playsInline controls preload="metadata" className="block"
            style={{ maxWidth: 340, width: '100%', borderRadius: 4, aspectRatio: '9 / 16', objectFit: 'cover' }} />
          {block.alt && <figcaption className="mt-2 text-center" style={{ fontSize: '12px', color: '#999' }}>{block.alt}</figcaption>}
        </figure>
      )
    case 'videorow':
      return (
        <div className="my-8 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(block.videos.length, 3)}, 1fr)` }}>
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
    case 'map':
      return (
        <div className="my-8" style={{ borderRadius: 4, overflow: 'hidden', border: '1px solid #000' }}>
          <iframe title={`Map — ${block.query}`} src={`https://maps.google.com/maps?q=${encodeURIComponent(block.query)}&z=14&output=embed`} width="100%" height="440" style={{ border: 0, display: 'block' }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      )
  }
}

export default async function EnArticlePage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const article = await getStoredArticle(slug)
  if (!article || !hasEnglish(article)) notFound()

  const enUrl = `${BASE_URL}/en/journal/${article.slug}`
  const live = isArticleLive(article)
  const blocks = parseBody(article.bodyEn || '')

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': enUrl,
    headline: article.titleEn,
    description: article.descriptionEn || '',
    datePublished: article.date,
    dateModified: article.date,
    inLanguage: 'en-US',
    mainEntityOfPage: { '@type': 'WebPage', '@id': enUrl },
    author: { '@type': 'Organization', name: 'NOUVELLE RIVE', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'NOUVELLE RIVE', logo: { '@type': 'ImageObject', url: `${BASE_URL}/icon-512.png` } },
    image: article.cover ? (article.cover.startsWith('http') ? article.cover : `${BASE_URL}${article.cover}`) : `${BASE_URL}/facade%20paysage.jpg`,
  }

  return (
    <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />

      <main className="min-h-screen bg-white">
        {!live && (
          <div className="text-center py-2 px-4 uppercase" style={{ background: bleu, color: '#fff', fontSize: '11px', letterSpacing: '0.12em', fontWeight: 600 }}>
            Draft — not published, not indexed
          </div>
        )}

        {article.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.cover} alt={article.titleEn || ''} className="w-full block" style={{ height: '78vh', maxHeight: 820, objectFit: 'cover', objectPosition: 'center' }} />
        )}

        <article className="max-w-3xl mx-auto px-6 py-16">
          <Link href="/en/journal" className="uppercase" style={{ fontSize: '11px', letterSpacing: '0.15em', color: bleu, fontWeight: 600 }}>
            ← Journal
          </Link>

          <p className="mt-8 uppercase font-semibold" style={{ fontSize: '11px', letterSpacing: '0.15em', color: bleu }}>
            {article.categoryEn || article.category}
          </p>

          <h1 id="titre" className="mt-4" style={{ fontSize: 'clamp(30px, 5vw, 46px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
            {article.titleEn}
          </h1>

          <p className="mt-4" style={{ fontSize: '13px', letterSpacing: '0.05em', color: '#999' }}>
            {formatDate(article.date)} · {article.readingMinutes} min read
          </p>

          <div className="w-full border-t border-black mt-8 mb-10" />

          {blocks.map((block, i) =>
            block.type === 'map' && article.mapMarkers?.length ? (
              <ArticleMap key={i} markers={article.mapMarkers} />
            ) : (
              <Block key={i} block={block} />
            ),
          )}

          {article.sources && article.sources.length > 0 && (
            <div className="mt-16 pt-8 border-t border-gray-200">
              <p className="uppercase font-semibold" style={{ fontSize: '11px', letterSpacing: '0.15em', color: '#999' }}>Sources</p>
              <ul className="mt-3 space-y-1">
                {article.sources.map((s, i) => (
                  <li key={i} style={{ fontSize: '12px', lineHeight: 1.5 }}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: '#999', textDecoration: 'underline', textUnderlineOffset: '2px' }}>{s.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </main>

      <footer className="border-t border-black py-8 text-center">
        <p style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#999' }}>NOUVELLE RIVE — 8 RUE DES ECOUFFES, PARIS</p>
      </footer>
    </div>
  )
}
