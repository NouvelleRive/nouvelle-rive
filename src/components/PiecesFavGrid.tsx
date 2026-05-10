'use client'

import LazyAutoplayVideo from '@/components/LazyAutoplayVideo'
import ProductGrid from '@/components/ProductGrid'

type Block =
  | { type: 'duo'; videos: string[]; products: any[] }
  | { type: 'solo'; videos: string[]; products: any[] }

// instagram embed helper (utilisé si une video URL n'est pas un .mp4)
function instagramEmbed(url: string): string | null {
  const m = url.match(/instagram\.com\/(reel|p)\/([^/?#]+)/i)
  if (!m) return null
  return `https://www.instagram.com/${m[1]}/${m[2]}/embed/?autoplay=1&muted=1`
}

function VideoBox({ url }: { url: string }) {
  if (/\.mp4(\?|$)/i.test(url)) {
    return <LazyAutoplayVideo src={url} className="w-full h-full object-cover" style={{ background: '#000' }} />
  }
  const embed = instagramEmbed(url)
  if (!embed) return null
  return <iframe src={embed} className="w-full h-full" style={{ border: 'none', background: '#fafafa' }} allowFullScreen allow="autoplay; encrypted-media" />
}

// Découpe vidéos + produits en blocs alternés duo/solo.
// Règle : nombre impair ou vidéo seule → full page (solo).
function buildBlocks(videos: string[], products: any[]): Block[] {
  const blocks: Block[] = []
  let vi = 0
  let pi = 0
  let cursor = 0 // 0 = duo, 1 = solo
  while (vi < videos.length || pi < products.length) {
    let type: 'duo' | 'solo' = cursor % 2 === 0 ? 'duo' : 'solo'
    let vs: string[]
    if (type === 'duo') {
      vs = videos.slice(vi, vi + 2)
      if (vs.length === 1) { type = 'solo' } // vidéo seule restante → full page
    } else {
      vs = videos.slice(vi, vi + 1)
    }
    vi += vs.length
    const ps = products.slice(pi, pi + 4)
    pi += ps.length
    if (vs.length === 0 && ps.length === 0) break
    blocks.push({ type, videos: vs, products: ps } as Block)
    cursor++
  }
  return blocks
}

interface Props {
  produits: any[]
  videos?: string[]
  title?: string
  className?: string
}

export default function PiecesFavGrid({ produits, videos = [], title, className = '' }: Props) {
  // Si pas de vidéos, simple grille produits
  if (!videos.length) {
    return (
      <div className={className}>
        {title && (
          <div className="px-6 md:px-12 pt-10 pb-4">
            <p className="uppercase tracking-widest font-semibold" style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '13px', letterSpacing: '0.2em' }}>
              {title}
            </p>
          </div>
        )}
        <ProductGrid produits={produits} columns={4} showFilters={false} />
      </div>
    )
  }

  const blocks = buildBlocks(videos, produits)

  return (
    <div className={className}>
      {title && (
        <div className="px-6 md:px-12 pt-10 pb-4">
          <p className="uppercase tracking-widest font-semibold" style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '13px', letterSpacing: '0.2em' }}>
            {title}
          </p>
        </div>
      )}
      {blocks.map((b, bi) => (
        <div key={bi}>
          {b.type === 'duo' && b.videos.length === 2 && (
            <div className="grid grid-cols-2" style={{ borderTop: '1px solid #000' }}>
              {b.videos.map((url, vi) => (
                <div key={vi} className="w-full bg-black" style={{ aspectRatio: '9 / 16', borderRight: vi === 0 ? '1px solid #000' : 'none' }}>
                  <VideoBox url={url} />
                </div>
              ))}
            </div>
          )}
          {b.type === 'solo' && b.videos.length === 1 && (
            <div className="w-full bg-black" style={{ aspectRatio: '9 / 16', borderTop: '1px solid #000' }}>
              <VideoBox url={b.videos[0]} />
            </div>
          )}
          {b.products.length > 0 && (
            <div style={{ borderTop: '1px solid #000' }}>
              <ProductGrid produits={b.products} columns={4} showFilters={false} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
