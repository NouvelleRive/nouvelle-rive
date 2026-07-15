import { NextResponse } from 'next/server'
import { getSitemapEntries, renderSitemapXml } from '@/lib/sitemap-data'

export const revalidate = 3600
export const dynamic = 'force-static'

export async function GET() {
  const entries = await getSitemapEntries()
  const xml = renderSitemapXml(entries)
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
