import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Embarque les polices DejaVu dans le bundle serverless de la route story
  // (Vercel/Lambda n'a aucune police système → texte en carrés sans ça).
  outputFileTracingIncludes: {
    '/api/instagram/publish-story': ['./src/assets/fonts/**'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        source: '/sitemap.xml',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' },
          { key: 'Content-Type', value: 'application/xml; charset=utf-8' },
        ],
      },
      {
        source: '/robots.txt',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=86400' },
        ],
      },
    ]
  },
};
export default nextConfig;