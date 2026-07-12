import { NextResponse } from 'next/server'
import sitemap from '../sitemap'

export const revalidate = 3600
export const dynamic = 'force-dynamic'

// URL alternative /sitemap-index.xml — même contenu que /sitemap.xml, mais nouveau nom
// pour forcer Google Search Console à tester un fresh sitemap sans passer par le
// cache d'erreur de l'ancien /sitemap.xml.
export async function GET() {
  const entries = await sitemap()
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((e) => {
      const lastmod = e.lastModified instanceof Date ? e.lastModified.toISOString() : e.lastModified
      return `<url><loc>${e.url}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}${e.changeFrequency ? `<changefreq>${e.changeFrequency}</changefreq>` : ''}${e.priority != null ? `<priority>${e.priority}</priority>` : ''}</url>`
    }),
    '</urlset>',
  ].join('\n')

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
