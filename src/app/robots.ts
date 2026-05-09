import type { MetadataRoute } from 'next'

const BASE_URL = 'https://www.nouvellerive.eu'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/vendeuse',
          '/vendeuse/',
          '/chineuse',
          '/chineuse/',
          '/deposante',
          '/deposante/',
          '/client',
          '/client/',
          '/login',
          '/checkout',
          '/panier',
          '/confirmation',
          '/api/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
