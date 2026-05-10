// Ajoute 3 reels Brujas via la lib video-utils (download + re-encode + upload)
import { addReelToChineuse } from './lib/video-utils.mjs'

const reels = [
  'https://www.instagram.com/reel/DYFAQuDIg9u/',
  'https://www.instagram.com/reel/DXZiCNuCKZ3/',
  'https://www.instagram.com/reel/DXPfczciCki/',
]

for (const url of reels) {
  console.log(`→ ${url}`)
  const newUrl = await addReelToChineuse('brujas', url)
  console.log(`  ✅ ${newUrl}`)
}
process.exit(0)
